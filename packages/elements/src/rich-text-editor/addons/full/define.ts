import '../actions/define.js';
import '../ai/define.js';
import '../colors/define.js';
import '../emoji/define.js';
import '../file-import/define.js';
import '../history/define.js';
import '../images/define.js';
import '../links/define.js';
import '../mentions/define.js';
import '../outline/define.js';
import '../slash-commands/define.js';
import '../tables/define.js';
import '../typography/define.js';
import { GeRichTextEditor } from '../../rich-text-editor.js';
import { fullAddon } from './full.js';

GeRichTextEditor.registerAddon(fullAddon);
