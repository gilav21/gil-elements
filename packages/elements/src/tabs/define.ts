import { defineElement } from '@gilav21/elements-base';
import '../skeleton/define.js';
import { GeTabs } from './tabs.js';
import { GeTabsContent } from './sub/tabs-content.js';
import { GeTabsList } from './sub/tabs-list.js';
import { GeTabsTrigger } from './sub/tabs-trigger.js';

defineElement('tabs', GeTabs);
defineElement('tabs-list', GeTabsList);
defineElement('tabs-trigger', GeTabsTrigger);
defineElement('tabs-content', GeTabsContent);
export { GeTabs, GeTabsContent, GeTabsList, GeTabsTrigger };
