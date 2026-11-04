import { defineElement } from '@gilav21/elements-base';
import { GeToast } from './toast.js';
import { GeToaster } from './sub/toaster.js';

defineElement('toast', GeToast);
defineElement('toaster', GeToaster);
