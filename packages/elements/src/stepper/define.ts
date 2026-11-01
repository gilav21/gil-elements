import { defineElement } from '@gilav21/elements-base';
import { GeStepper } from './stepper.js';
import { GeStepperContent } from './sub/stepper-content.js';
import { GeStepperDescription } from './sub/stepper-description.js';
import { GeStepperItem } from './sub/stepper-item.js';
import { GeStepperSeparator } from './sub/stepper-separator.js';
import { GeStepperTitle } from './sub/stepper-title.js';
import { GeStepperTrigger } from './sub/stepper-trigger.js';

defineElement('stepper', GeStepper);
defineElement('stepper-item', GeStepperItem);
defineElement('stepper-trigger', GeStepperTrigger);
defineElement('stepper-title', GeStepperTitle);
defineElement('stepper-description', GeStepperDescription);
defineElement('stepper-separator', GeStepperSeparator);
defineElement('stepper-content', GeStepperContent);
export { GeStepper, GeStepperContent, GeStepperDescription, GeStepperItem, GeStepperSeparator, GeStepperTitle, GeStepperTrigger };
