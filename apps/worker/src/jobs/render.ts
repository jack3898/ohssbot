import { type jobs } from '@bot/constants';
import type Bull from 'bullmq';
import { jobsModel, storageModel, usersModel } from 'mongo.js';
import {
    download,
    downloadToDisk,
    getSizeBytes,
    hash,
    makeDir,
    readFileAsStream,
    rm,
    writeFile
} from '@bot/utils';
import path from 'path';
import { s3Storage } from 'storage.js';
import { env } from 'env.js';
import { DanserSettings } from 'utils/index.js';
import { Replay } from 'osr-loader';
import { Client as OsuApi } from 'osu-web.js';
import { danserStdoutParser } from 'utils/danserStdoutParser.js';
import { spawn } from 'child_process';

/**
 * Run the Danser executable with the given options to process a replay into a video.
 * Downloads the replay file from the database and saves it to a temporary location before running Danser.
 */
export async function render(job: Bull.Job<jobs.RecordJob>): Promise<void> {
    try {
        await jobsModel.findOneAndUpdate(
            { jobId: job.id, discordId: job.data.discordUserId },
            { status: 'active' }
        );

        // Replay file should be small enough to download and process in memory
        const replayFile = await download(new URL(job.data.replayDownloadUrl));

        if (!replayFile.byteLength) {
            throw new Error(`Unable to download replay from Discord CDN.`);
        }

        const user = await usersModel.findOne({ discordId: job.data.discordUserId });
        const oauthToken = user?.osuAuth?.accessToken;

        if (!oauthToken) {
            throw new Error('User is not authenticated with the Osu! API.');
        }

        const danserSettings = new DanserSettings();

        const replaysTempDir = danserSettings.osuReplaysDir;
        const videosTempDir = danserSettings.recordingOutputDir;
        const songsTempDir = danserSettings.osuSongsDir;

        // Restore dirs as empty
        await makeDir(replaysTempDir, { recursive: true });
        await makeDir(videosTempDir, { recursive: true });
        await makeDir(songsTempDir, { recursive: true });

        // Download beatmap from a mirror
        const osuApi = new OsuApi(oauthToken);
        const parsedReplay = await new Replay().readBuffer(replayFile);
        const beatmapChecksum = parsedReplay.data?.beatmapMD5;

        if (!beatmapChecksum) {
            throw new Error('Could not find beatmap checksum in the replay.');
        }

        const beatmap = await osuApi.beatmaps.lookupBeatmap({
            query: { checksum: beatmapChecksum }
        });

        const id = beatmap?.beatmapset_id;

        if (!id) {
            throw new Error('Could not find beatmapset ID for the replay.');
        }

        const beatmapOszLocation = path.resolve(songsTempDir, `${beatmapChecksum}.osz`);

        await downloadToDisk(new URL(`https://beatconnect.io/b/${id}/`), beatmapOszLocation);

        const replayFileLocation = path.resolve(replaysTempDir, `${beatmapChecksum}.osr`);
        const replayVideoLocation = path.resolve(videosTempDir, `${beatmapChecksum}.mp4`);

        await writeFile(replayFileLocation, replayFile);

        await danserSettings.patch();

        // RUN DANSER 🥳
        await new Promise<void>((resolve, reject) => {
            const process = spawn(env.DANSER_EXECUTABLE_PATH, [
                `--replay=${replayFileLocation}`,
                `--out=${beatmapChecksum}`,
                ...job.data.danserOptions
            ]);

            process.stdout.on('data', (stdout) => {
                try {
                    console.log(stdout.toString());
                    const data = danserStdoutParser(stdout.toString());

                    if (data.type === 'PROGRESS') {
                        job.updateProgress(data.percentage);
                    }
                } catch (error) {
                    console.error('Error parsing danser stdout:', error);
                }
            });

            process.stderr.on('data', (stderr) => {
                console.error(stderr.toString());
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }

                reject(new Error(`Process ${env.DANSER_EXECUTABLE_PATH} exited with code ${code}`));
            });
        });

        console.info('Finished rendering video! 📽️');

        const videoHash = await hash(readFileAsStream(replayVideoLocation), 'sha1');
        const s3Filename = `${videoHash}.mp4`;
        const videoFileSize = await getSizeBytes(replayVideoLocation);

        if (!videoFileSize) {
            throw new Error('Could not find the video file after rendering.');
        }

        if (videoFileSize.gB > 10) {
            throw new Error(
                `Unexpectedly large file size. Aborting the upload. Expected less than ${videoFileSize.gBFriendly}`
            );
        }

        console.info(`Uploading ${replayVideoLocation} as ${s3Filename} to object storage...`);

        await s3Storage.upload({
            filename: s3Filename,
            body: readFileAsStream(replayVideoLocation),
            acl: 'public-read'
        });

        console.info(`Uploaded ${replayVideoLocation} as ${s3Filename} to object storage!`);

        const fileDownloadUrl = new URL(s3Storage.endpoint);

        fileDownloadUrl.pathname = `/${env.S3_BUCKET_NAME}/${s3Filename}`;

        await storageModel.findOneAndDelete({ sha1hash: videoHash });

        await storageModel.create({
            url: fileDownloadUrl.toString(),
            name: `${parsedReplay.data.playerName} - ${beatmap.beatmapset.title_unicode} - ${parsedReplay.data.scoreId}.mp4`,
            type: 'mp4',
            size: videoFileSize.B,
            sha1Hash: videoHash,
            discordOwnerId: job.data.discordUserId
        });

        await rm(replaysTempDir, { recursive: true });
        await rm(videosTempDir, { recursive: true });
        await rm(songsTempDir, { recursive: true });

        if (job.id) {
            await jobsModel.findOneAndUpdate(
                { jobId: job.id, discordId: job.data.discordUserId },
                { status: 'completed' }
            );
        }
    } catch (error) {
        // BullMQ will automatically retry the job if an error is thrown
        // But, it does not log the error by default it seems so we should log it here
        console.error('Error processing job:', error);

        if (job.id) {
            await jobsModel.findOneAndUpdate(
                { jobId: job.id, discordId: job.data.discordUserId },
                { status: 'failed' }
            );
        }

        throw error;
    }
}
