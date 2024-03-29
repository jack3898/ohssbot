import { z } from 'zod';

function toUrl(strUrl: string): URL {
    return new URL(strUrl);
}

export const coreEnv = {
    NODE_ENV: z.enum(['development', 'production', 'test'])
};

export const jwtEnv = {
    JWT_SECRET: z.string().min(36)
};

export const discordEnv = {
    DISCORD_TOKEN: z.string().min(1),
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_GUILD_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    DISCORD_REDIRECT_URI: z.string().transform(toUrl)
};

export const danserEnv = {
    DANSER_EXECUTABLE_PATH: z.string().min(1),
    DANSER_ROOT_DIR: z.string().min(1),
    DANSER_SONGS_DIR: z.string().min(1),
    DANSER_REPLAYS_DIR: z.string().min(1),
    DANSER_VIDEOS_DIR: z.string().min(1),
    DANSER_SKINS_DIR: z.string().min(1)
};

export const mongoEnv = {
    MONGO_URI: z.string().transform(toUrl)
};

export const keydbEnv = {
    KEYDB_URI: z.string().transform(toUrl)
};

export const s3Env = {
    S3_DOMAIN: z.string().min(1),
    S3_REGION: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_BUCKET_NAME: z.string().min(1)
};

export const osuEnv = {
    OSU_CLIENT_ID: z.string().min(1),
    OSU_CLIENT_SECRET: z.string().min(1),
    OSU_REDIRECT_URI: z.string().transform(toUrl)
};

export const siteEnv = {
    SITE_URL: z.string().transform(toUrl)
};
