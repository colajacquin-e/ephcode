/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { ThemeIcon } from '../../../../base/common/themables.js';

export class EphcodePersistentActionsContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.ephcodePersistentActions';

	private claudeButton: HTMLElement | undefined;

	constructor(
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();
		this.setupPersistentActions();
	}

	private setupPersistentActions(): void {
		const checkAndUpdate = () => {
			// Small delay to let the DOM settle after editor changes
			setTimeout(() => this.updateClaudeButton(), 50);
		};

		this._register(this.editorGroupsService.onDidChangeActiveGroup(() => checkAndUpdate()));
		this._register(this.editorGroupsService.onDidAddGroup(() => {
			checkAndUpdate();
			this.closeEmptyGroups();
		}));
		this._register(this.editorGroupsService.onDidRemoveGroup(() => checkAndUpdate()));

		// Listen for editor open/close in active group
		const watchGroup = () => {
			const group = this.editorGroupsService.activeGroup;
			if (group) {
				this._register(group.onDidCloseEditor(() => {
					checkAndUpdate();
					this.closeEmptyGroups();
				}));
				this._register(group.onDidModelChange(() => checkAndUpdate()));
			}
		};
		watchGroup();
		this._register(this.editorGroupsService.onDidChangeActiveGroup(() => watchGroup()));

		// Initial check
		checkAndUpdate();
	}

	private closeEmptyGroups(): void {
		// ephcode: auto-close empty editor groups to prevent split view buildup
		// ephcode: short delay to let editors open in new groups before checking
		mainWindow.setTimeout(() => {
			const groups = this.editorGroupsService.groups;
			if (groups.length <= 1) {
				return;
			}
			for (const group of groups) {
				if (group.count === 0) {
					this.editorGroupsService.removeGroup(group);
				}
			}
		}, 1);
	}

	private updateClaudeButton(): void {
		const group = this.editorGroupsService.activeGroup;
		const hasEditors = group && group.count > 0;

		if (hasEditors) {
			// Remove custom button — extension's own icon takes over
			if (this.claudeButton) {
				this.claudeButton.remove();
				this.claudeButton = undefined;
			}
			return;
		}

		// No editors open — add persistent Claude Code button
		if (this.claudeButton) {
			return; // already showing
		}

		// Find the editor part (always exists, unlike tabs container)
		// eslint-disable-next-line no-restricted-syntax
		const editorPart = mainWindow.document.querySelector('.monaco-workbench .part.editor');
		if (!editorPart) {
			return;
		}

		this.claudeButton = mainWindow.document.createElement('div');
		this.claudeButton.style.cssText = `
			position: absolute; top: 0; right: 8px; height: 35px;
			display: flex; align-items: center; z-index: 3;
			-webkit-app-region: no-drag;
		`;

		const btn = mainWindow.document.createElement('a');
		btn.className = `action-label codicon ${ThemeIcon.asClassName({ id: 'terminal' })}`;
		btn.title = 'Open Claude Code';
		btn.role = 'button';
		btn.style.cssText = `
			width: 28px; height: 28px; font-size: 16px;
			display: flex; align-items: center; justify-content: center;
			cursor: pointer; color: #9a9ea4; border-radius: 4px;
			transition: color 0.15s, background 0.15s;
		`;
		btn.addEventListener('mouseenter', () => {
			btn.style.color = '#c5cbc8';
			btn.style.background = '#2a3b4255';
		});
		btn.addEventListener('mouseleave', () => {
			btn.style.color = '#9a9ea4';
			btn.style.background = 'transparent';
		});
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.commandService.executeCommand('claude-vscode.editor.open').then(undefined, () => {
				this.commandService.executeCommand('workbench.action.terminal.toggleTerminal');
			});
		});

		this.claudeButton.appendChild(btn);
		editorPart.appendChild(this.claudeButton);
	}
}
