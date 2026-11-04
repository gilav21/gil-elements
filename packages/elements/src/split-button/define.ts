import { defineElement } from '@gilav21/elements-base';
import '../button/define.js';
import { GeSplitButton } from './split-button.js';
import { GeSplitButtonItem } from './sub/split-button-item.js';
import { GeSplitButtonMenu } from './sub/split-button-menu.js';
import { GeSplitButtonPrimary } from './sub/split-button-primary.js';

defineElement('split-button', GeSplitButton);
defineElement('split-button-primary', GeSplitButtonPrimary);
defineElement('split-button-menu', GeSplitButtonMenu);
defineElement('split-button-item', GeSplitButtonItem);
