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
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { mainWindow } from '../../../../base/browser/window.js';

const FIRST_LAUNCH_KEY = 'ephcode.firstLaunchComplete';

const EPHCODE_EXTENSIONS: { id: string; name: string }[] = [
	{ id: 'anthropic.claude-code', name: 'Claude Code' },
	{ id: 'llvm-vs-code-extensions.vscode-clangd', name: 'clangd (C/C++)' },
	{ id: 'ms-vscode.cmake-tools', name: 'CMake Tools' },
	{ id: 'eamodio.gitlens', name: 'GitLens' },
	{ id: 'tintinweb.graphviz-interactive-preview', name: 'Graphviz Interactive Preview' },
	{ id: 'SirTori.indenticator', name: 'Indenticator' },
	{ id: 'ms-python.python', name: 'Python' },
	{ id: 'ms-pyright.pyright', name: 'Pyright' },
	{ id: 'mechatroner.rainbow-csv', name: 'Rainbow CSV' },
	{ id: 'rafamel.subtle-brackets', name: 'Subtle Match Brackets' },
	{ id: 'tomoki1207.pdf', name: 'vscode-pdf' },
	{ id: 'Percy.vscode-numpy-viewer', name: 'vscode-numpy-viewer' },
];

export class EphcodeFirstLaunchContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.ephcodeFirstLaunch';

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IHostService private readonly hostService: IHostService,
		@IExtensionGalleryService private readonly galleryService: IExtensionGalleryService,
		@IWorkbenchExtensionManagementService private readonly extensionManagementService: IWorkbenchExtensionManagementService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
		this.showFirstLaunchPrompt();
	}

	private async showFirstLaunchPrompt(): Promise<void> {
		const isComplete = this.storageService.getBoolean(FIRST_LAUNCH_KEY, StorageScope.APPLICATION, false);
		if (isComplete) {
			return;
		}

		const result = await this.showOverlay();

		if (result === 'exit') {
			this.hostService.close();
			return;
		}

		if (result === 'install') {
			await this.installExtensions();
		}

		this.storageService.store(FIRST_LAUNCH_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
	}

	private showOverlay(): Promise<'install' | 'skip' | 'exit'> {
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
				font-size: 14px; font-weight: 400; margin: 0 0 12px 0;
				color: #6b7078;
			`;
			title.appendChild(document.createTextNode('Welcome to '));

			const brand = document.createElement('span');
			brand.style.cssText = `
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace;
				font-size: 32px; font-weight: 700; letter-spacing: 8px;
				display: block; margin-top: 8px;
			`;

			// Create individual letter spans for the scramble animation
			const TARGET = 'EPHCODE';
			const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';
			const letterSpans: HTMLSpanElement[] = [];
			for (let i = 0; i < TARGET.length; i++) {
				const span = document.createElement('span');
				span.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
				span.style.cssText = 'transition: color 0.1s; color: #c5cbc8;';
				brand.appendChild(span);
				letterSpans.push(span);
			}

			// Rainbow color palette
			const rainbowColors = [
				'#e05534', '#d4782e', '#b8520a', '#c4966a',
				'#779e7f', '#5a9a8a', '#5a8a9a', '#8a6a9a',
				'#9aaa9e', '#8eb89a', '#e8734f', '#6aaa9a',
			];

			// Scramble animation: random chars + rainbow for ~5s, then settle
			const TOTAL_DURATION = 5000;
			const TICK_MS = 50;
			const startTime = Date.now();
			const settled = new Array(TARGET.length).fill(false);

			const scrambleInterval = mainWindow.setInterval(() => {
				const elapsed = Date.now() - startTime;
				const progress = Math.min(elapsed / TOTAL_DURATION, 1);

				for (let i = 0; i < TARGET.length; i++) {
					if (settled[i]) {
						continue;
					}

					// Each letter settles at a staggered time
					const settleThreshold = 0.3 + (i / TARGET.length) * 0.6;
					if (progress >= settleThreshold) {
						settled[i] = true;
						letterSpans[i].textContent = TARGET[i];
						letterSpans[i].style.color = '#c5cbc8';
						letterSpans[i].style.textShadow = '0 0 20px #445a4d44';
						continue;
					}

					// Random character
					letterSpans[i].textContent = CHARS[Math.floor(Math.random() * CHARS.length)];

					// Rainbow color cycling
					const colorIdx = Math.floor((elapsed / 80 + i * 3) % rainbowColors.length);
					letterSpans[i].style.color = rainbowColors[colorIdx];
				}

				// All settled — done
				if (settled.every(s => s)) {
					mainWindow.clearInterval(scrambleInterval);
				}
			}, TICK_MS);

			title.appendChild(brand);

			// Subtitle
			const subtitle = document.createElement('p');
			subtitle.style.cssText = `
				font-size: 14px; color: #6b7078; margin: 0 0 32px 0;
				line-height: 1.5;
			`;

			const ephgoatSpan = document.createElement('span');
			ephgoatSpan.textContent = 'ephgoat';
			ephgoatSpan.style.cssText = 'color: #779e7f; cursor: default; transition: color 0.2s;';

			subtitle.appendChild(document.createTextNode('If you aspire to code at the legendary level of '));
			subtitle.appendChild(ephgoatSpan);
			subtitle.appendChild(document.createTextNode(' himself, ephcode will bless your environment with these sacred extensions:'));

			// Extension list
			const list = document.createElement('div');
			list.style.cssText = `
				background: #1b1d20; border-radius: 8px; padding: 16px 20px;
				margin: 0 0 32px 0; max-height: 220px; overflow-y: auto;
				border: 1px solid #2a3b4244;
			`;
			for (const ext of EPHCODE_EXTENSIONS) {
				const item = document.createElement('div');
				item.style.cssText = `
					font-size: 13px; color: #9a9ea4; padding: 3px 0;
					font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				`;
				item.textContent = ext.name;
				list.appendChild(item);
			}

			// Buttons container
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

			const installBtn = makeButton('Enable ephmode', true);
			const skipBtn = makeButton('My config > his config', false);
			const exitBtn = makeButton('I\'m lame, exit', false);

			// Style skip button with orange accent
			skipBtn.style.background = 'transparent';
			skipBtn.style.color = '#b8520a';
			skipBtn.style.border = '1px solid #b8520a44';
			skipBtn.addEventListener('mouseenter', () => {
				skipBtn.style.background = '#b8520a22';
			});
			skipBtn.addEventListener('mouseleave', () => {
				skipBtn.style.background = 'transparent';
			});

			// Hidden button - revealed when "ephgoat" is clicked
			skipBtn.style.display = 'none';

			// Easter egg: click "ephgoat" to reveal skip button
			ephgoatSpan.addEventListener('mouseenter', () => {
				ephgoatSpan.style.color = '#b8520a';
				ephgoatSpan.style.cursor = 'pointer';
			});
			ephgoatSpan.addEventListener('mouseleave', () => {
				ephgoatSpan.style.color = '#779e7f';
			});
			ephgoatSpan.addEventListener('click', () => {
				if (skipBtn.style.display === 'none') {
					skipBtn.style.display = 'block';
					skipBtn.style.opacity = '0';
					mainWindow.requestAnimationFrame(() => {
						skipBtn.style.transition = 'opacity 0.3s';
						skipBtn.style.opacity = '1';
					});
				}
			});

			const cleanup = () => {
				overlay.style.transition = 'opacity 0.2s';
				overlay.style.opacity = '0';
				setTimeout(() => overlay.remove(), 200);
			};

			installBtn.addEventListener('click', () => { cleanup(); resolve('install'); });
			skipBtn.addEventListener('click', () => { cleanup(); resolve('skip'); });
			exitBtn.addEventListener('click', () => { cleanup(); resolve('exit'); });

			buttons.appendChild(installBtn);
			buttons.appendChild(skipBtn);
			buttons.appendChild(exitBtn);

			card.appendChild(title);
			card.appendChild(subtitle);
			card.appendChild(list);
			card.appendChild(buttons);
			overlay.appendChild(card);
			mainWindow.document.body.appendChild(overlay);
		});
	}

	private async installExtensions(): Promise<void> {
		const document = mainWindow.document;

		// Create blocking overlay
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
			color: #c5cbc8; margin: 0 0 24px 0;
		`;
		title.textContent = 'EPHCODE';

		const statusText = document.createElement('p');
		statusText.style.cssText = `
			font-size: 14px; color: #9a9ea4; margin: 0 0 24px 0;
		`;
		statusText.textContent = 'Preparing your environment...';

		// Progress bar
		const progressTrack = document.createElement('div');
		progressTrack.style.cssText = `
			background: #1b1d20; border-radius: 4px; height: 6px;
			overflow: hidden; margin: 0 0 16px 0;
			border: 1px solid #2a3b4244;
		`;
		const progressFill = document.createElement('div');
		progressFill.style.cssText = `
			background: linear-gradient(90deg, #445a4d, #779e7f);
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

		// "Let's go!" button (hidden initially)
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
			const extensionInfos: IExtensionInfo[] = EPHCODE_EXTENSIONS.map(ext => ({ id: ext.id }));
			const unsortedExtensions = await this.galleryService.getExtensions(extensionInfos, CancellationToken.None);
			const galleryExtensions = [...unsortedExtensions].sort((a, b) => {
				const nameA = EPHCODE_EXTENSIONS.find(e => e.id.toLowerCase() === a.identifier.id.toLowerCase())?.name || a.identifier.id;
				const nameB = EPHCODE_EXTENSIONS.find(e => e.id.toLowerCase() === b.identifier.id.toLowerCase())?.name || b.identifier.id;
				return nameA.localeCompare(nameB);
			});

			let installed = 0;
			let failed = 0;
			const total = galleryExtensions.length;

			if (total === 0) {
				statusText.textContent = 'Could not reach the marketplace.';
				addLog('Error: no extensions found.', '#e05534');
				goBtn.style.display = 'block';
				await new Promise<void>(resolve => goBtn.addEventListener('click', () => resolve()));
				overlay.remove();
				return;
			}

			addLog(`Found ${total} extensions. Installing...`);

			for (const extension of galleryExtensions) {
				const extName = EPHCODE_EXTENSIONS.find(e => e.id.toLowerCase() === extension.identifier.id.toLowerCase())?.name || extension.identifier.id;
				try {
					statusText.textContent = `Installing ${extName}...`;
					await this.extensionManagementService.installFromGallery(extension);
					installed++;
					progressFill.style.width = `${(installed / total) * 100}%`;
					addLog(`✓ ${extName}`, '#779e7f');
				} catch (err) {
					failed++;
					// allow-any-unicode-next-line
					addLog(`✗ ${extName}`, '#e05534');
					console.error(`[ephcode] Failed to install ${extension.identifier.id}:`, err);
				}
			}

			// Auto-remove Pylance
			try {
				statusText.textContent = 'Cleaning up...';
				const localExtensions = await this.extensionManagementService.getInstalled();
				const pylance = localExtensions.find(e => e.identifier.id.toLowerCase() === 'ms-python.vscode-pylance');
				if (pylance) {
					await this.extensionManagementService.uninstall(pylance);
					addLog('✓ Removed Pylance (not supported on forks)', '#6b7078');
				}
			} catch {
				// Silently skip
			}

			progressFill.style.width = '100%';
			progressFill.style.background = 'linear-gradient(90deg, #445a4d, #779e7f)';

			if (failed > 0) {
				statusText.textContent = `Done. ${installed} installed, ${failed} failed.`;
			} else {
				statusText.textContent = 'ephmode activated. You are now coding like ephgoat.';
				statusText.style.color = '#779e7f';
			}

			goBtn.style.display = 'block';
			goBtn.textContent = 'Let\'s go!';

			await new Promise<void>(resolve => goBtn.addEventListener('click', () => resolve()));

			overlay.style.transition = 'opacity 0.3s';
			overlay.style.opacity = '0';
			await new Promise(r => setTimeout(r, 300));
			overlay.remove();

			// Reload to apply all extension changes
			this.hostService.reload();
		} catch (err) {
			console.error('[ephcode] Extension install error:', err);
			statusText.textContent = 'Something went wrong.';
			addLog(`Error: ${err}`, '#e05534');
			goBtn.style.display = 'block';
			goBtn.textContent = 'Continue anyway';
			await new Promise<void>(resolve => goBtn.addEventListener('click', () => resolve()));
			overlay.remove();
		}
	}
}
