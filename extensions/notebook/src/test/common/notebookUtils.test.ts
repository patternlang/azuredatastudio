/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { NotebookUtils } from '../../common/notebookUtils';
import * as should from 'should';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as os from 'os';
import * as path from 'path';
import * as uuid from 'uuid';
import { promises as fs } from 'fs';
import { ApiWrapper } from '../../common/apiWrapper';
import { tryDeleteFile } from './testUtils';
import { pythonKernelSpec } from '../common';

describe('notebookUtils Tests', function (): void {
	let notebookUtils: NotebookUtils;
	let apiWrapperMock: TypeMoq.IMock<ApiWrapper>;
	before(function (): void {
		apiWrapperMock = TypeMoq.Mock.ofInstance(new ApiWrapper());
		notebookUtils = new NotebookUtils(apiWrapperMock.object);
	});

	describe('newNotebook', function (): void {
		it('Should open a new notebook successfully', async function (): Promise<void> {
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
			await notebookUtils.newNotebook(undefined);
			should(azdata.nb.notebookDocuments.length).equal(1, 'There should be exactly 1 open Notebook document');
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
		});

		it('Opening an untitled editor after closing should re-use previous untitled name', async function (): Promise<void> {
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
			await notebookUtils.newNotebook(undefined);
			should(azdata.nb.notebookDocuments.length).equal(1, 'There should be exactly 1 open Notebook document');
			should(azdata.nb.notebookDocuments[0].fileName).equal('Notebook-0', 'The first Untitled Notebook should have an index of 0');
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
			await notebookUtils.newNotebook(undefined);
			should(azdata.nb.notebookDocuments.length).equal(1, 'There should be exactly 1 open Notebook document after second opening');
			should(azdata.nb.notebookDocuments[0].fileName).equal('Notebook-0', 'The first Untitled Notebook should have an index of 0 after closing first Untitled Notebook');
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		});

		it('Untitled Name index should increase', async function (): Promise<void> {
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
			await notebookUtils.newNotebook(undefined);
			should(azdata.nb.notebookDocuments.length).equal(1, 'There should be exactly 1 open Notebook document');
			const secondNotebook = await notebookUtils.newNotebook(undefined);
			should(azdata.nb.notebookDocuments.length).equal(2, 'There should be exactly 2 open Notebook documents');
			should(secondNotebook.document.fileName).equal('Notebook-1', 'The second Untitled Notebook should have an index of 1');
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
		});
	});

	describe('openNotebook', function () {
		it('opens a Notebook successfully', async function (): Promise<void> {
			const notebookPath = path.join(os.tmpdir(), `OpenNotebookTest_${uuid.v4()}.ipynb`);
			const notebookUri = vscode.Uri.file(notebookPath);
			try {
				await fs.writeFile(notebookPath, '');
				apiWrapperMock.setup(x => x.showOpenDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve([notebookUri]));
				await notebookUtils.openNotebook();
				should(azdata.nb.notebookDocuments.find(doc => doc.fileName === notebookUri.fsPath)).not.be.undefined();
				await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			} finally {
				tryDeleteFile(notebookPath);
			}
		});

		it('shows error if unexpected error is thrown', async function (): Promise<void> {
			apiWrapperMock.setup(x => x.showOpenDialog(TypeMoq.It.isAny())).throws(new Error('Unexpected error'));
			await notebookUtils.openNotebook();
		});
	});

	describe('runActiveCell', function () {
		it('runs active cell as expected', async function (): Promise<void> {
			this.timeout(60000);
			const notebookPath = path.join(os.tmpdir(), `RunActiveCellTest_${uuid.v4()}.ipynb`);
			const notebookUri = vscode.Uri.file(notebookPath);
			try {
				await fs.writeFile(notebookPath, '');
				apiWrapperMock.setup(x => x.showOpenDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve([notebookUri]));
				await notebookUtils.openNotebook();
				await notebookUtils.addCell('code');
				const nbEditor = azdata.nb.activeNotebookEditor;
				console.log('CHANGING KERNEL');
				await nbEditor.changeKernel(pythonKernelSpec);
				console.log('KERNEL CHANGED');
				should(nbEditor.document.cells[0].contents.execution_count).be.equal(undefined, 'The active cell should not have any executions before running');
				await notebookUtils.runActiveCell();
				should(nbEditor.document.cells[0].contents.execution_count).be.equal(1, 'The active cell should have 1 execution after running');
				await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			} finally {
				tryDeleteFile(notebookPath);
			}
		});

		it('shows error if no notebook visible', async function (): Promise<void> {
			apiWrapperMock.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
			await notebookUtils.runActiveCell();
			apiWrapperMock.verify(x => x.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());
		});
	});
});
