import {test as base,expect} from '@playwright/test';
import {instrumentWorkflowPage} from '../../scripts/lib/workflow-evidence.mjs';
export {expect};
export const test=base.extend({workflowEvidence:[async({page},use)=>{await instrumentWorkflowPage(page);await use();},{auto:true}]});
