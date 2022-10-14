#!/usr/bin/env node
import Excel from 'exceljs';
import flat from 'flat';
const { unflatten } = flat;

import parseArgs from 'minimist';
import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  checkForMultipleJSONFileErrors,
  getFileName,
  getSourceFileType,
  isJSON,
  isXLSX,
  parseErrorMessage,
  writeByCheckingParent
} from "./utils.js";

function printHelp() {
  console.log('Usage');
  console.log('i18n-json-to-xlsx-converter [options] files');
  console.log('where options are:');
  console.log('-s\tspecial strings which will be switched for keys (only for JSON -> XLSX)');
  console.log('-o\toutput file name (JSON -> XLSX) / directory (XLSX -> JSON)');
  console.log('-l\tdesired languages');
  console.log('-h\tprints this message');
}

(async () => {
  try {
    const argv = parseArgs(process.argv.slice(2));
    const inputFilesParam = argv['_'];
    const specialsParam = argv.s;
    const outputParam = argv.o;
    const langsParam = argv.l;

    if(argv.h) {
      printHelp();

      process.exit(0);
    }

    if(!inputFilesParam || inputFilesParam.length === 0) {
      parseErrorMessage('No input files specified');
      printHelp();

      process.exit(1);
    }

    let specialStrings: string[];
    if(specialsParam) {
      if(typeof specialsParam === 'string') {
        specialStrings = [specialsParam];
      } else if(Array.isArray(specialsParam) && typeof specialsParam[0] === 'string') {
        specialStrings = specialsParam;
      } else {
        parseErrorMessage('Special string can only be strings');

        process.exit(1);
      }
    }

    let outputFilePath = path.join(inputFilesParam[0], './translations.xlsx');
    if(outputParam) {
      if(typeof outputParam !== 'string') {
        parseErrorMessage('There can be just one output file');
        process.exit(1);
      }

      outputFilePath = outputParam;
    }

    const sourceFileType = getSourceFileType(inputFilesParam[0]);
    const outputFileType = getSourceFileType(outputFilePath);
    if(isJSON(sourceFileType)) {
      if(inputFilesParam.length > 1) {
        checkForMultipleJSONFileErrors(inputFilesParam, process);
      }

      if(!isXLSX(outputFileType)) {
        if(!outputFilePath.includes('.')) {
          outputFilePath = outputFilePath.endsWith('.') ? `${outputFilePath}xlsx` : `${outputFilePath}.xlsx`
          console.log(chalk.yellow(`\nAdding '.xlsx' to output file`));
        } else {
          parseErrorMessage('Wrong output file format (must be \'.xlsx\')');
          process.exit(1);
        }
      }

      console.log(chalk.yellow(`\nProcessing! \nConverting JSON to XLSX for the file${inputFilesParam.length > 1 ? 's' : ''}:`));
      console.log(chalk.magentaBright(inputFilesParam.join('\n')))
    } else if(isXLSX(sourceFileType)) {
      if(inputFilesParam.length > 1) {
        parseErrorMessage('Only one XLSX file can be converted.');
        process.exit(1);
      }

      if(langsParam) {
        console.log(chalk.gray(`-l option has no effect when converting from XLSX -> JSON`));
      }
      if(specialsParam) {
        console.log(chalk.gray(`-s option has no effect when converting from XLSX -> JSON`));
      }
      console.log(chalk.yellow(`\nProcessing! \nConverting XLSX to JSON for the file:`));
      console.log(chalk.magentaBright(inputFilesParam.join('\n')))
    } else {
      parseErrorMessage('File type is not supported. Either use JSON or XLSX file to convert.');
      process.exit(1);
    }

    const languages = ['Key'];
    if(!langsParam) {
      languages.push('EN'); // EN is default language
    } else {
      languages.push(...langsParam);
    }

    // TODO: formatting for top row (bold, center, bigger?)

    // [SUGGESTION]: only add new translations - when you have translated all the strings, but you add new ones.

    if (isXLSX(sourceFileType)) {
      const filePath = inputFilesParam[0]

      try {
        const workbook = new Excel.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheets = workbook.worksheets;

        const wsLanguages: Map<string, boolean> = new Map();
        // get languages for each worksheet
        for( const ws of worksheets ) {
          let blank = false;
          let cellIndex = 2; // start at 1 and first is just 'Key'
          const firstRow = ws.getRow(1);
          while( !blank ) {
            const val = firstRow.getCell(cellIndex).value as string;
            if(val) {
              wsLanguages.set(val, true);
            } else {
              blank = true;
            }
            cellIndex += 1;
          }
        }

        const languages = Array.from(wsLanguages.keys());
        const languagesPathsMap = new Map<string, string>();
        languages.forEach((l) => {
          if(outputParam) {
            languagesPathsMap.set(l, path.join(outputParam, l));
          } else {
            languagesPathsMap.set(l, path.join('./', l));
          }
        });
        const languagesPaths = Array.from(languagesPathsMap.values());
        console.log(chalk.yellow('Creating language directories:'));
        console.log(chalk.magentaBright(languagesPaths.join('\n')));

        let promises: Promise<any>[] = languagesPaths.map((lang) => fs.promises.mkdir(lang, { recursive: true }));
        await Promise.all(promises);

        const langMap = new Map<string, Map<string, any>>();
        worksheets.forEach((ws) => {
          let blank = false;
          languages.forEach((lang, langIndex) => {
            const langJson: any = {};
            let rowIndex = 2; // starts at 1 and first row are just languages

            while( !blank ) {
              const row = ws.getRow(rowIndex);
              const key = row.getCell(1).value as string;
              const value = row.getCell(langIndex + 2).value as string;

              if(key && value) {
                langJson[key] = value
              } else {
                blank = true;
              }

              rowIndex += 1;
            }

            const langMapEntry = langMap.get(lang);
            if(langMapEntry) {
              langMapEntry.set(ws.name, unflatten(langJson));
            } else {
              const map = new Map<string, any>();
              map.set(ws.name, unflatten(langJson));
              langMap.set(lang, map);
            }
          });
        });

        console.log(chalk.yellow(`Outputting files:`));
        promises = [];
        langMap.forEach((map, lang) => {
          map.forEach((json, sheetName) => {
            const filePath = languagesPathsMap.get(lang) ?? lang;
            console.log(chalk.magentaBright(`${filePath}/${sheetName}.json`));

            promises.push(fs.promises.writeFile(`${filePath}/${sheetName}.json`, JSON.stringify(json, null, 2)));
          });
        });

        await Promise.all(promises);
      } catch(e) {
        console.error(chalk.red(`Error: ${e}`));

        process.exit(1);
      }
    } else {
      const workbook = new Excel.Workbook();

      for (const JSONFile of inputFilesParam!) {
        const filename = getFileName(JSONFile);
        const sourceBuffer = await fs.promises.readFile(JSONFile);
        const sourceText = sourceBuffer.toString();
        const sourceData = JSON.parse(sourceText);
        const worksheet = workbook.addWorksheet(filename);
        let rowCount = 1;

        const writeToXLSX = (key: string, value: string) => {
          const rows = worksheet.getRow(rowCount);

          rows.getCell(1).value = key;

          // Check for null, "" of the values and assign semantic character for that
          rows.getCell(2).value = value ?? '-';

          rowCount += 1;
        };

        const rows = worksheet.getRow(rowCount);
        languages.forEach((lang, i) => rows.getCell(i + 1).value = lang);
        rowCount += 1;

        const parseAndWrite = (parentKey: string | null, targetObject: any) => {
          const keys = Object.keys(targetObject);

          for (const key of keys as string[]) {
            let element: any = targetObject[key];
            if (specialStrings && specialStrings.includes(element)) {
              element = key;
            }

            if (typeof element === 'object' && element !== null) {
              parseAndWrite(writeByCheckingParent(parentKey, key), element);
            } else {
              writeToXLSX(writeByCheckingParent(parentKey, key), element);
            }
          }
        };

        parseAndWrite(null, sourceData);

        languages.forEach((_, i) => worksheet.getColumn(i + 1).width = 50);
      }

      try{
        await workbook.xlsx.writeFile(outputFilePath)
        console.log(chalk.yellow(`Output file location: ${outputFilePath}`));
        console.log(chalk.green(`File conversion is successful!\n`));
      } catch(e: any) {
        console.error(chalk.red(`Error: ${e}`), e.stack);

        process.exit(1);
      }
    }
  } catch (e: any) {
    console.error(chalk.red(`Error: ${e}`), e.stack, e);

    process.exit(1);
  }
})();
