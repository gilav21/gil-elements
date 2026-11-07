import { defineElement } from '@gilav21/elements-base';
import '../popover/define.js';
import '../input/define.js';
import '../input-group/define.js';
import '../scroll-area/define.js';
import '../tooltip/define.js';
import { GeEmojiPicker } from './emoji-picker.js';
import { GeEmojiPickerContent } from './sub/emoji-picker-content.js';
import { GeEmojiPickerTrigger } from './sub/emoji-picker-trigger.js';

defineElement('emoji-picker', GeEmojiPicker);
defineElement('emoji-picker-trigger', GeEmojiPickerTrigger);
defineElement('emoji-picker-content', GeEmojiPickerContent);
