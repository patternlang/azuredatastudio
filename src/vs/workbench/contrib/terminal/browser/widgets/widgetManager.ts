/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from 'vs/base/common/lifecycle';
import { ITerminalWidget } from 'vs/workbench/contrib/terminal/browser/widgets/widgets';
import { IHoverService } from 'vs/workbench/services/hover/browser/hover';

export class TerminalWidgetManager implements IDisposable {
	private _container: HTMLElement | undefined;
	private _attached: Map<string, ITerminalWidget> = new Map();

	constructor(@IHoverService private readonly _hoverService: IHoverService) {
	}

	attachToElement(terminalWrapper: HTMLElement) {
		if (!this._container) {
			this._container = document.createElement('div');
			this._container.classList.add('terminal-widget-container');
			terminalWrapper.appendChild(this._container);
		}
	}

	dispose(): void {
		if (this._container && this._container.parentElement) {
			this._container.parentElement.removeChild(this._container);
			this._container = undefined;
		}
	}

	hideHovers(): void {
		this._hoverService.hideHover();
	}

	attachWidget(widget: ITerminalWidget): IDisposable | undefined {
		if (!this._container) {
			return undefined; // {{SQL CARBON EDIT}} strict-null-check
		}
		this._attached.get(widget.id)?.dispose();
		widget.attach(this._container);
		this._attached.set(widget.id, widget);
		return {
			dispose: () => {
				const current = this._attached.get(widget.id);
				if (current === widget) {
					this._attached.delete(widget.id);
					widget.dispose();
				}
			}
		};
	}
}