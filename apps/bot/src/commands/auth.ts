import {
    type CommandInteraction,
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} from 'discord.js';
import { type Command } from 'types';
import { env } from 'env';

export const auth: Command = {
    get name(): string {
        return this.definition.name;
    },
    definition: new SlashCommandBuilder()
        .setName('auth')
        .setDescription('Associate your Discord account with your Osu! account through this bot.'),
    async execute(interaction: CommandInteraction): Promise<void> {
        const osuSearchParams = new URLSearchParams({
            client_id: env.OSU_CLIENT_ID,
            redirect_uri: env.OSU_REDIRECT_URI.toString(),
            response_type: 'code',
            scope: 'public',
            state: interaction.user.id
        });

        const osuOAuthUrl = new URL(`https://osu.ppy.sh/oauth/authorize`);

        osuOAuthUrl.search = osuSearchParams.toString();

        const authButton = new ButtonBuilder()
            .setLabel('Link account')
            .setStyle(ButtonStyle.Link)
            .setURL(osuOAuthUrl.toString());

        const actionRow = new ActionRowBuilder().addComponents(authButton);

        await interaction.reply({
            content:
                'Click the button to link your Osu! account. The bot will not have access to your password, and only use the the account to fetch beatmap details from your uploaded replays.',
            // @ts-expect-error - This is a valid interaction reply, but discord.js types are complaining.
            components: [actionRow],
            ephemeral: true
        });
    }
};
