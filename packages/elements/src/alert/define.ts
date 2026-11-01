import { defineElement } from '@gilav21/elements-base';
import { GeAlert } from './alert.js';
import { GeAlertDescription } from './sub/alert-description.js';
import { GeAlertTitle } from './sub/alert-title.js';

defineElement('alert', GeAlert);
defineElement('alert-title', GeAlertTitle);
defineElement('alert-description', GeAlertDescription);
