import * as path from "path";
import chalk from "chalk";

export function documentSavePath(filePath: string, outputFileName: string) {
  let destinationPath = '';

  if (filePath.includes('\\')) {
    destinationPath = filePath.substring(0, filePath.lastIndexOf('\\'));
  } else if (filePath.includes('/')) {
    destinationPath = filePath.substring(0, filePath.lastIndexOf('/'));
  }

  return path.resolve(destinationPath, outputFileName);
}

export function getFileName(filePath: string) {
  if (filePath.includes('\\')) {
    const startIndex = filePath.lastIndexOf('\\') + 1
    return filePath.substring(startIndex, startIndex + filePath.length - 1).split('.')[0];
  } else if (filePath.includes('/')) {
    const startIndex = filePath.lastIndexOf('/') + 1
    return filePath.substring( startIndex, startIndex + filePath.length - 1).split('.')[0];
  }

  return filePath.split('.')[0];
}

export const isJSON = (sourceFileType: string) => sourceFileType === 'json';

export const isXLSX = (sourceFileType: string) => sourceFileType === 'xlsx';

export function getSourceFileType(filePath: string) {
  const arr = filePath.split(".");      // Split the string using dot as separator
  const lastVal = arr.pop();       // Get last element
  return (lastVal || '').toLowerCase();
}

export function getFileExtension(filePath: string) {
  const sourceFileType = (filePath.split('.')[1] || '').toLowerCase();

  return !isXLSX(sourceFileType) ? '.xlsx' : '.json';
}

export function parseErrorMessage(message: string) {
  return console.warn(chalk.red(message));
}

export function addKeyConnectors(arr: string[]) {
  return arr.join('.');
}

export function writeByCheckingParent(parentKey: string | null, key: string) {
  let writeKey: string;

  parentKey !== null ? (writeKey = addKeyConnectors([parentKey, key])) : (writeKey = key);

  return writeKey;
}

export function checkForMultipleJSONFileErrors(filePaths: string[], process: NodeJS.Process) {
  const isMultiplePathCorrect = filePaths.every((jsonFilePathName) => jsonFilePathName.includes('.json'));

  if (!isMultiplePathCorrect) {
    const isOneJSONPath = filePaths.some((jsonFilePathName) => jsonFilePathName.includes('.json'));

    if (isOneJSONPath) {
      console.error(chalk.red('One of the multiple path entries of the JSON file path is wrong.'));
      process.exit(1);
    } else if (!isOneJSONPath) {
      console.error(chalk.red('Multiple file conversion only works for JSON files.'));
      process.exit(1);
    }
  }
}

export function isMultipleJSONFilePathsValid(filePath: string): boolean {
  const multipleJSON = filePath.split(',');

  return multipleJSON.length > 1 && multipleJSON.every((jsonFilePathName) => jsonFilePathName.includes('.json'));
}

export function getJSONFilePaths(filePath: string) {
  return filePath.split(',').map((JSONFilePath) => JSONFilePath.trim());
}
