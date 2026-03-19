/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { EphcodeFirstLaunchContribution } from './ephcodeFirstLaunch.js';
import { EphcodePersistentActionsContribution } from './ephcodePersistentActions.js';

registerWorkbenchContribution2(EphcodeFirstLaunchContribution.ID, EphcodeFirstLaunchContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(EphcodePersistentActionsContribution.ID, EphcodePersistentActionsContribution, WorkbenchPhase.AfterRestored);
