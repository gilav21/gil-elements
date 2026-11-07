import type { RichTextAddon } from '../../rich-text-host.js';
import { actionsAddon } from '../actions/actions.js';
import { aiAddon } from '../ai/ai.js';
import { colorsAddon } from '../colors/colors.js';
import { emojiAddon } from '../emoji/emoji.js';
import { fileImportAddon } from '../file-import/file-import.js';
import { historyAddon } from '../history/history.js';
import { imagesAddon } from '../images/images.js';
import { linksAddon } from '../links/links.js';
import { mentionsAddon } from '../mentions/mentions.js';
import { outlineAddon } from '../outline/outline.js';
import { slashCommandsAddon } from '../slash-commands/slash-commands.js';
import { tablesAddon } from '../tables/tables.js';
import { typographyAddon } from '../typography/typography.js';

const ADDONS: readonly RichTextAddon[] = [
    historyAddon,
    slashCommandsAddon,
    mentionsAddon,
    aiAddon,
    typographyAddon,
    colorsAddon,
    linksAddon,
    imagesAddon,
    tablesAddon,
    fileImportAddon,
    emojiAddon,
    actionsAddon,
    outlineAddon,
];

export const RICH_TEXT_FULL_ADDONS: readonly string[] = ADDONS.map((addon) => addon.id);

/** Every addon at once; `options` is the editor's `addonOptions` map, so each addon keeps its own entry. */
export const fullAddon: RichTextAddon = {
    id: 'full',
    covers: RICH_TEXT_FULL_ADDONS,
    setup(host, options) {
        const byId = (options ?? {}) as Readonly<Record<string, unknown>>;
        const teardowns = ADDONS.map((addon) => addon.setup(host, byId[addon.id]));
        return () => {
            for (const teardown of teardowns) if (teardown) teardown();
        };
    },
};
