/* Modules */
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import csv from 'csvtojson';
import { parse } from 'json2csv';
import { apiRequest } from './api-request.js';
import { chunkArray } from './chunks.js';
import moment from 'moment';
import { median } from './median-math.js';

/* Variables */
const file = 'urls.csv'; // File name for list of URLs to check
const folder = 'results'; // Name of folder for output
const fullJson = true; // Variable for testing purposes. Extracts full API response into JSON File
const chunkNum = 10; // Number or URLs per batch
const numTest = 1; // Number of Lab test to run (Lighthouse)
const device = 'mobile'; // Test viewport. 'desktop' also available

////* Start of script *////
console.time();
// Create results folder
existsSync(`./${folder}/`)
  ? console.log(`${folder} folder exists`)
  : mkdir(`${folder}`);

const getUrls = async () => {
  const list = await csv().fromFile(file);
  return list.map(({ url }) => url);
};

const getSpeedData = async (testNum = 1) => {
  // Get URL List
  const urlList = await getUrls().catch((err) =>
    console.log(`Error reading file ${err}`)
  );
  const splitChunks = urlList.length / chunkNum;
  console.log(
    `The set of urls has been split up in ${Math.ceil(splitChunks)} chunk/s`
  );

  // Holding arrays for results
  const labDataRes = [];
  const labResErrors = [];
  const fieldDataRes = [];
  const fieldOriginRes = [];
  const fieldOriginDomain = new Set();

  // Break URL list into chunks to prevent API errors
  const chunks = chunkArray(urlList, chunkNum);

  // Loop through chunks
  for (let [i, chunk] of chunks.entries()) {
    // Iterate through list of URLs within chunk
    for (let round = 0; round < testNum; round++) {
      // Log round of testing
      console.log(`Testing round #${round + 1} of chunk #${i + 1}`);

      // Loop trough array to create batch of promises (array)
      const promises = chunk.map((testUrl) => apiRequest(testUrl, device));

      // Send all requests in parallel
      const rawBatchResults = await Promise.allSettled(promises);

      // Iterate through API responses
      const results = rawBatchResults.map((res, index) => {
        if (res.status === 'fulfilled') {
          if (fullJson === true) {
            !existsSync(`./${folder}/json/`) ? mkdir(`${folder}/json`) : null;
            writeFile(
              `${folder}/json/resp-${round + index}.json`,
              JSON.stringify(res, null, 2)
            );
          }
          // Variables to make extractions easier
          const fieldMetrics = res.value.loadingExperience.metrics;
          const originFallback = res.value.loadingExperience.origin_fallback;
          const labAudit = res.value.lighthouseResult.audits;

          // If it's the 1st round of testing & test results have field data (CrUX)
          if (round === 0 && res.value.loadingExperience.metrics) {
            if (!originFallback) {
              // Extract Field metrics (if there are)
              const fieldFCP =
                fieldMetrics.FIRST_CONTENTFUL_PAINT_MS?.percentile ?? 'no data';
              const fieldFID =
                fieldMetrics.FIRST_INPUT_DELAY_MS?.percentile ?? 'no data';
              const fieldLCP =
                fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile ??
                'no data';
              const fieldCLS =
                fieldMetrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ??
                'no data';

              // Construct FieldResult object
              const fieldResObj = {
                'test url': res.value.loadingExperience.id,
                fcp: fieldFCP,
                fid: fieldFID,
                lcp: fieldLCP,
                cls: fieldCLS / 100,
                date: moment().format('YYYY-MM-DD'),
              };
              // Push to fieldRes array
              fieldDataRes.push(fieldResObj);
            } else {
              if (!fieldOriginDomain.has(res.value.loadingExperience.id)) {
                console.log(
                  `No field data for ${res.value.id}, extracting origin data from ${res.value.loadingExperience.id} instead... `
                );

                // Otherwise Extract Origin Field metrics (if there are)
                const fieldFCP =
                  fieldMetrics.FIRST_CONTENTFUL_PAINT_MS.percentile;
                const fieldFID = fieldMetrics.FIRST_INPUT_DELAY_MS.percentile;
                const fieldLCP =
                  fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS.percentile;
                const fieldCLS =
                  fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile;

                // Construct fieldResult object
                const fieldResObj = {
                  'test url': res.value.loadingExperience.id,
                  fcp: fieldFCP,
                  fid: fieldFID,
                  lcp: fieldLCP,
                  cls: fieldCLS / 100,
                  date: moment().format('YYYY-MM-DD'),
                };
                // Push object to fieldOrigin array
                fieldOriginRes.push(fieldResObj);
                fieldOriginDomain.add(res.value.loadingExperience.id);
              }
            }
          }

          // Extract Lab metrics
          const testUrl = res.value.lighthouseResult.finalUrl;
          const TTFB = labAudit['server-response-time'].numericValue;
          const TTI =
            labAudit.metrics.details?.items[0].interactive ?? 'no data';
          const labFCP =
            labAudit.metrics.details?.items[0].firstContentfulPaint ??
            'no data';
          const labLCP =
            labAudit.metrics.details?.items[0].largestContentfulPaint ??
            'no data';
          const labCLS = parseFloat(
            labAudit['cumulative-layout-shift'].displayValue
          );
          const TBT =
            labAudit.metrics.details?.items[0].totalBlockingTime ?? 'no data';
          const labMaxFID =
            labAudit.metrics.details?.items[0].maxPotentialFID ?? 'no data';
          const speedIndex =
            labAudit.metrics.details?.items[0].speedIndex ?? 'no data';
          const pageSize = parseFloat(
            (labAudit['total-byte-weight'].numericValue / 1000000).toFixed(3)
          );
          const date = moment().format('YYYY-MM-DD');

          // Construct object
          const finalObj = {
            testUrl,
            TTFB,
            labFCP,
            labLCP,
            labCLS,
            TTI,
            speedIndex,
            TBT,
            labMaxFID,
            pageSize,
            date,
          };
          return finalObj;
        } else {
          console.log(`Problem retrieving results for ${urlList[index]}`);
          console.log(
            res.reason.response?.data.error.message ??
              `Connection error: ${res.reason.message}`
          );
          labResErrors.push({
            url: urlList[index],
            reason:
              res.reason.response?.data.error.message ??
              `Connection error: ${res.reason.message}`,
          });
        }
      });
      // Push spreaded results to labDataRes array
      labDataRes.push(...results);
    }
  }

  // If there if there is field data
  if (fieldDataRes.length > 0) {
    // Write field data results into CSV
    console.log('Writing field data...');
    writeFile(`./${folder}/results-field.csv`, parse(fieldDataRes)).catch(
      (err) => console.log(`Error writing field JSONfile: ${err}`)
    );
  }
  // If there if there is field data
  if (fieldOriginRes.length > 0) {
    // Write field data results into CSV
    console.log('Writing origin field data...');
    writeFile(
      `./${folder}/results-origin-field.csv`,
      parse(fieldOriginRes)
    ).catch((err) => console.log(`Error writing Origin JSON file: ${err}`));
  }

  // Prevent map loop errors by filtering undefined responses (promise rejections)
  const labDataResFilter = labDataRes.filter((obj) => obj !== undefined);
  // Write lab data results into CSV
  console.log('Writing lab data...');
  writeFile(`./${folder}/results-test.csv`, parse(labDataResFilter)).catch(
    (err) => console.log(`Error writing Lab JSON file:${err}`)
  );

  // If there are any errors
  if (labResErrors.length > 0) {
    // Write field data results into CSV
    console.log('Writing error data...');
    writeFile(`./${folder}/errors.csv`, parse(labResErrors)).catch((err) =>
      console.log(`Error writing Origin JSON file: ${err}`)
    );
  }

  // If running more than 1 test calculate median
  if (testNum > 1) {
    console.log('Calculating median...');

    // Collect analysed URLs in set
    const seen = new Set();

    // Reduce labDataRes array to calcualte median for the same URLs in array
    const labMedian = labDataResFilter.reduce((acc, cur, index, labArray) => {
      if (!seen.has(cur.testUrl)) {
        // Add URL to seen list
        seen.add(cur.testUrl);

        // Filter same URLs from results
        const sameUrl = labArray.filter((obj) => obj.testUrl === cur.testUrl);

        // Create object witht the same properties but calculating the median value per url
        const objMedian = {
          testUrl: cur.testUrl,
          TTFB: median(sameUrl.map(({ TTFB }) => TTFB)),
          labFCP: median(sameUrl.map(({ labFCP }) => labFCP)),
          labLCP: median(sameUrl.map(({ labLCP }) => labLCP)),
          labCLS: median(sameUrl.map(({ labCLS }) => labCLS)),
          TTI: median(sameUrl.map(({ TTI }) => TTI)),
          speedIndex: median(sameUrl.map(({ speedIndex }) => speedIndex)),
          TBT: median(sameUrl.map(({ TBT }) => TBT)),
          labMaxFID: median(sameUrl.map(({ labMaxFID }) => labMaxFID)),
          pageSize: median(sameUrl.map(({ pageSize }) => pageSize)),
          date: moment().format('YYYY-MM-DD'),
        };

        // Push to accumulator
        acc.push(objMedian);
      }

      // Return accumulator
      return acc;
    }, []);

    // Write medians to CSV file
    writeFile(`./${folder}/results-median.csv`, parse(labMedian)).catch((err) =>
      console.log(`Error writing file:${err}`)
    );
  }

  // Log amount of errors
  console.log(`Encountered ${labResErrors.length} errors running the tests`);
  console.log(`Ran ${testNum} test/s for a total of ${urlList.length} URL/s`);
  console.timeEnd();
};

// Call getSpeedData function (add number of test to run per URL)
getSpeedData(numTest);
