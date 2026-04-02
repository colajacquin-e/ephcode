/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IExtensionGalleryService, IExtensionInfo } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { IWorkbenchExtensionManagementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';

const REMOTE_FIRST_LAUNCH_KEY = 'ephcode.remoteFirstLaunchComplete';

const EPHCODE_REMOTE_EXTENSIONS: { id: string; name: string }[] = [
	{ id: 'anthropic.claude-code', name: 'Claude Code' },
	{ id: 'llvm-vs-code-extensions.vscode-clangd', name: 'clangd (C/C++)' },
	{ id: 'ms-vscode.cmake-tools', name: 'CMake Tools' },
	{ id: 'eamodio.gitlens', name: 'GitLens' },
	{ id: 'SirTori.indenticator', name: 'Indenticator' },
	{ id: 'ms-python.python', name: 'Python' },
	{ id: 'ms-pyright.pyright', name: 'Pyright' },
	{ id: 'mechatroner.rainbow-csv', name: 'Rainbow CSV' },
	{ id: 'rafamel.subtle-brackets', name: 'Subtle Match Brackets' },
	{ id: 'tomoki1207.pdf', name: 'vscode-pdf' },
	{ id: 'Percy.vscode-numpy-viewer', name: 'vscode-numpy-viewer' },
];

export class EphcodeRemoteFirstLaunchContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.ephcodeRemoteFirstLaunch';

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IHostService private readonly hostService: IHostService,
		@IExtensionGalleryService private readonly galleryService: IExtensionGalleryService,
		@IWorkbenchExtensionManagementService private readonly extensionManagementService: IWorkbenchExtensionManagementService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
	) {
		super();
		this.checkRemoteFirstLaunch();
	}

	private async checkRemoteFirstLaunch(): Promise<void> {
		// Only trigger on remote connections
		if (!this.environmentService.remoteAuthority) {
			return;
		}

		const isComplete = this.storageService.getBoolean(REMOTE_FIRST_LAUNCH_KEY, StorageScope.APPLICATION, false);
		if (isComplete) {
			return;
		}

		const result = await this.showRemoteOverlay();

		if (result === 'install') {
			await this.installRemoteExtensions();
		}

		this.storageService.store(REMOTE_FIRST_LAUNCH_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
	}

	private showRemoteOverlay(): Promise<'install' | 'skip'> {
		return new Promise(resolve => {
			const document = mainWindow.document;

			const overlay = document.createElement('div');
			overlay.style.cssText = `
				position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
				background: #1b1d20; z-index: 100000;
				display: flex; align-items: center; justify-content: center;
				font-family: 'Avenir Next', 'Avenir', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				color: #c5cbc8; overflow: hidden;
			`;

			const card = document.createElement('div');
			card.style.cssText = `
				background: #23272f; border-radius: 12px; padding: 48px 56px;
				max-width: 540px; width: 100%; box-shadow: 0 24px 80px rgba(0,0,0,0.5);
				border: 1px solid #2a3b42;
			`;

			// Title
			const title = document.createElement('h1');
			title.style.cssText = `
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace;
				font-size: 28px; font-weight: 700; letter-spacing: 6px;
				color: #c5cbc8; margin: 0 0 8px 0;
			`;
			title.textContent = 'EPHCODE';

			// Remote badge
			const badge = document.createElement('div');
			badge.style.cssText = `
				display: inline-block; padding: 4px 12px; border-radius: 4px;
				background: #5a8a9a22; border: 1px solid #5a8a9a44;
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				font-size: 11px; color: #5a8a9a; letter-spacing: 2px;
				margin: 0 0 24px 0; text-transform: uppercase;
			`;
			badge.textContent = 'Remote Session';

			// Subtitle
			const subtitle = document.createElement('p');
			subtitle.style.cssText = `
				font-size: 14px; color: #9a9ea4; margin: 0 0 12px 0;
				line-height: 1.6;
			`;
			subtitle.textContent = 'You just connected to a remote machine — nice.';

			const subtitle2 = document.createElement('p');
			subtitle2.style.cssText = `
				font-size: 14px; color: #6b7078; margin: 0 0 28px 0;
				line-height: 1.6;
			`;
			subtitle2.textContent = 'Your remote environment is missing the ephcode extensions. Install them here so you get the same setup on every machine you touch.';

			// Extension list
			const list = document.createElement('div');
			list.style.cssText = `
				background: #1b1d20; border-radius: 8px; padding: 16px 20px;
				margin: 0 0 32px 0; max-height: 200px; overflow-y: auto;
				border: 1px solid #2a3b4244;
			`;
			for (const ext of EPHCODE_REMOTE_EXTENSIONS) {
				const item = document.createElement('div');
				item.style.cssText = `
					font-size: 13px; color: #9a9ea4; padding: 3px 0;
					font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				`;
				item.textContent = ext.name;
				list.appendChild(item);
			}

			// Buttons
			const buttons = document.createElement('div');
			buttons.style.cssText = `
				display: flex; flex-direction: column; gap: 10px;
			`;

			const makeButton = (label: string, primary: boolean): HTMLButtonElement => {
				const btn = document.createElement('button');
				btn.textContent = label;
				btn.style.cssText = `
					padding: 12px 24px; border-radius: 6px; font-size: 14px;
					font-weight: 500; cursor: pointer; border: none;
					transition: background 0.2s, transform 0.1s;
					font-family: 'Avenir Next', 'Avenir', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
					${primary
						? 'background: #445a4d; color: #c5cbc8;'
						: 'background: transparent; color: #6b7078; border: 1px solid #2a3b42;'
					}
				`;
				btn.addEventListener('mouseenter', () => {
					btn.style.background = primary ? '#5a6e5e' : '#2a3b4244';
				});
				btn.addEventListener('mouseleave', () => {
					btn.style.background = primary ? '#445a4d' : 'transparent';
				});
				btn.addEventListener('mousedown', () => {
					btn.style.transform = 'scale(0.98)';
				});
				btn.addEventListener('mouseup', () => {
					btn.style.transform = 'scale(1)';
				});
				return btn;
			};

			const installBtn = makeButton('Enable ephmode on remote', true);
			const skipBtn = makeButton('Skip for now', false);

			const cleanup = () => {
				overlay.style.transition = 'opacity 0.2s';
				overlay.style.opacity = '0';
				setTimeout(() => overlay.remove(), 200);
			};

			installBtn.addEventListener('click', () => { cleanup(); resolve('install'); });
			skipBtn.addEventListener('click', () => { cleanup(); resolve('skip'); });

			buttons.appendChild(installBtn);
			buttons.appendChild(skipBtn);

			card.appendChild(title);
			card.appendChild(badge);
			card.appendChild(subtitle);
			card.appendChild(subtitle2);
			card.appendChild(list);
			card.appendChild(buttons);
			overlay.appendChild(card);
			mainWindow.document.body.appendChild(overlay);
		});
	}

	private async installRemoteExtensions(): Promise<void> {
		const document = mainWindow.document;

		const overlay = document.createElement('div');
		overlay.style.cssText = `
			position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
			background: #1b1d20; z-index: 100000;
			display: flex; align-items: center; justify-content: center;
			font-family: 'Avenir Next', 'Avenir', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			color: #c5cbc8;
		`;

		const card = document.createElement('div');
		card.style.cssText = `
			background: #23272f; border-radius: 12px; padding: 48px 56px;
			max-width: 540px; width: 100%; box-shadow: 0 24px 80px rgba(0,0,0,0.5);
			border: 1px solid #2a3b42; text-align: center;
		`;

		const title = document.createElement('h1');
		title.style.cssText = `
			font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace;
			font-size: 24px; font-weight: 700; letter-spacing: 6px;
			color: #c5cbc8; margin: 0 0 8px 0;
		`;
		title.textContent = 'EPHCODE';

		const badge = document.createElement('div');
		badge.style.cssText = `
			display: inline-block; padding: 4px 12px; border-radius: 4px;
			background: #5a8a9a22; border: 1px solid #5a8a9a44;
			font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
			font-size: 11px; color: #5a8a9a; letter-spacing: 2px;
			margin: 0 0 24px 0; text-transform: uppercase;
		`;
		badge.textContent = 'Remote Session';

		const statusText = document.createElement('p');
		statusText.style.cssText = `
			font-size: 14px; color: #9a9ea4; margin: 0 0 24px 0;
		`;
		statusText.textContent = 'Setting up your remote environment...';

		// Progress bar
		const progressTrack = document.createElement('div');
		progressTrack.style.cssText = `
			background: #1b1d20; border-radius: 4px; height: 6px;
			overflow: hidden; margin: 0 0 16px 0;
			border: 1px solid #2a3b4244;
		`;
		const progressFill = document.createElement('div');
		progressFill.style.cssText = `
			background: linear-gradient(90deg, #445a4d, #5a8a9a);
			height: 100%; width: 0%; border-radius: 4px;
			transition: width 0.3s ease;
		`;
		progressTrack.appendChild(progressFill);

		// Extension log
		const logArea = document.createElement('div');
		logArea.style.cssText = `
			background: #1b1d20; border-radius: 8px; padding: 12px 16px;
			margin: 0 0 32px 0; max-height: 180px; overflow-y: auto;
			border: 1px solid #2a3b4244; text-align: left;
			font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
			font-size: 12px; color: #6b7078;
		`;

		const goBtn = document.createElement('button');
		goBtn.textContent = 'Let\'s go!';
		goBtn.style.cssText = `
			padding: 12px 36px; border-radius: 6px; font-size: 14px;
			font-weight: 600; cursor: pointer; border: none;
			background: #445a4d; color: #c5cbc8;
			display: none; margin: 0 auto;
			transition: background 0.2s;
		`;
		goBtn.addEventListener('mouseenter', () => { goBtn.style.background = '#5a6e5e'; });
		goBtn.addEventListener('mouseleave', () => { goBtn.style.background = '#445a4d'; });

		card.appendChild(title);
		card.appendChild(badge);
		card.appendChild(statusText);
		card.appendChild(progressTrack);
		card.appendChild(logArea);
		card.appendChild(goBtn);
		overlay.appendChild(card);
		mainWindow.document.body.appendChild(overlay);

		const addLog = (msg: string, color?: string) => {
			const line = document.createElement('div');
			line.style.cssText = `padding: 2px 0; color: ${color || '#6b7078'};`;
			line.textContent = msg;
			logArea.appendChild(line);
			logArea.scrollTop = logArea.scrollHeight;
		};

		try {
			addLog('Fetching extension list from marketplace...');
			const extensionInfos: IExtensionInfo[] = EPHCODE_REMOTE_EXTENSIONS.map(ext => ({ id: ext.id }));
			const unsortedExtensions = await this.galleryService.getExtensions(extensionInfos, CancellationToken.None);
			const galleryExtensions = [...unsortedExtensions].sort((a, b) => {
				const nameA = EPHCODE_REMOTE_EXTENSIONS.find(e => e.id.toLowerCase() === a.identifier.id.toLowerCase())?.name || a.identifier.id;
				const nameB = EPHCODE_REMOTE_EXTENSIONS.find(e => e.id.toLowerCase() === b.identifier.id.toLowerCase())?.name || b.identifier.id;
				return nameA.localeCompare(nameB);
			});

			let installed = 0;
			let failed = 0;
			const total = galleryExtensions.length;

			if (total === 0) {
				statusText.textContent = 'Could not reach the marketplace.';
				addLog('Error: no extensions found.', '#e05534');
				goBtn.style.display = 'block';
				await new Promise<void>(r => goBtn.addEventListener('click', () => r()));
				overlay.remove();
				return;
			}

			addLog(`Found ${total} extensions. Installing on remote...`);

			for (const extension of galleryExtensions) {
				const extName = EPHCODE_REMOTE_EXTENSIONS.find(e => e.id.toLowerCase() === extension.identifier.id.toLowerCase())?.name || extension.identifier.id;
				try {
					statusText.textContent = `Installing ${extName}...`;
					await this.extensionManagementService.installFromGallery(extension);
					installed++;
					progressFill.style.width = `${(installed / total) * 100}%`;
					// allow-any-unicode-next-line
					addLog(`✓ ${extName}`, '#5a8a9a');
				} catch (err) {
					failed++;
					// allow-any-unicode-next-line
					addLog(`✗ ${extName}`, '#e05534');
					console.error(`[ephcode] Failed to install ${extension.identifier.id} on remote:`, err);
				}
			}

			// Auto-remove Pylance
			try {
				statusText.textContent = 'Cleaning up...';
				const localExtensions = await this.extensionManagementService.getInstalled();
				const pylance = localExtensions.find(e => e.identifier.id.toLowerCase() === 'ms-python.vscode-pylance');
				if (pylance) {
					await this.extensionManagementService.uninstall(pylance);
					// allow-any-unicode-next-line
					addLog('✓ Removed Pylance (not supported on forks)', '#6b7078');
				}
			} catch {
				// Silently skip
			}

			progressFill.style.width = '100%';

			if (failed > 0) {
				statusText.textContent = `Done. ${installed} installed, ${failed} failed.`;
			} else {
				statusText.textContent = 'ephmode activated';
				statusText.style.color = '#5a8a9a';
			}

			goBtn.style.display = 'block';
			goBtn.textContent = 'Let\'s go!';

			await new Promise<void>(r => goBtn.addEventListener('click', () => r()));

			overlay.style.transition = 'opacity 0.3s';
			overlay.style.opacity = '0';
			await new Promise(r => setTimeout(r, 300));
			overlay.remove();

			this.hostService.reload();
		} catch (err) {
			console.error('[ephcode] Remote extension install error:', err);
			statusText.textContent = 'Something went wrong.';
			addLog(`Error: ${err}`, '#e05534');
			goBtn.style.display = 'block';
			goBtn.textContent = 'Continue anyway';
			await new Promise<void>(r => goBtn.addEventListener('click', () => r()));
			overlay.remove();
		}
	}
}
