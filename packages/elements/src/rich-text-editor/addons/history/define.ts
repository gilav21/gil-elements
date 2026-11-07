import '../../../button/define.js';
import '../../../dialog/define.js';
import '../../../popover/define.js';
import { GeRichTextEditor } from '../../rich-text-editor.js';
import { historyAddon } from './history.js';

GeRichTextEditor.registerAddon(historyAddon);
