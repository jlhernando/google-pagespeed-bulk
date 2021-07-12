# Google PageSpeed Insights API for Node.js

Script to extract Google PageSpeed API Data from multiple URLs. The script allows to perform multiple tests in the same run and calculate the median value for each extracted speed metric and Core Web Vitals metric from the total number of results.

## How to install and run the script

1. This script uses ES modules syntax. Make sure that you have installed Node.js version 14 or higher. To check what version you are running type in your terminal:

   ```bash
   node -v
   ```

2. Clone/Download the repository. Type in your terminal one of the following options:

   ```bash
   # Git
   git clone https://github.com/jlhernando/google-pagespeed-bulk.git

   # OR Github's CLI
   gh repo clone https://github.com/jlhernando/google-pagespeed-bulk
   ```

3. Install the modules from the script. Type in your terminal:

   ```bash
   npm install
   ```

4. Get a Google API Key. You can do it from your [GCP console](https://console.cloud.google.com/apis/credentials) or from [from Google's documentation](https://developers.google.com/speed/docs/insights/v5/get-started)
5. Add your key to “api-request.js” file.
6. Add URLs into the 'urls.csv' file but keep the "url" header.
7. You can change the number of tests per URL you'd like to perform. Change the variable `numTest` in Line 16 to your desired number of tests. Maximum recommended 5.
   ```javascript
   // Example tu run 3 lab tests
   const numTest = 1; // Number of Lab test to run (Lighthouse). Line 16
   ```
8. You can also change the device variable from `mobile` to `desktop` is you want to get different viewport results.
9. Run the script. Type in your terminal:
   ```bash
   npm start
   ```

## The output

Once the script has finished, you will find the output under the "results" folder. There you will find at least 2 files:

- results-test.csv
- results-test.json

These files will contain the lab metrics for each succesful test result from the URLs in your 'urls.csv' file. The metrics extarcted are:

- Time To First Byte in milisenconds (TTFB)
- First Contentful Paint in miliseconds (labFCP)
- Largest Contentful Paint in miliseconds (labLCP)
- Cummulative Layout Shift (labCLS)
- Time To Interactive in miliseconds (TTI)
- Speed Index in miliseconds (speedIndex)
- Total Blocking Time in miliseconds (TBT)
- Max Potential First Input Delay in miliseconds (labMaxFID)
- Size fo the page in Megabytes(pageSize)

You may also find 6 additional files:

- results-median.csv
- results-median.json
- results-field.csv
- results-field.json
- results-origin.csv
- results-origin.json

The "results-median" files are the median values for each lab metric extracted as long as there were a minimum of 3 rounds of testing performed.

The "results-field" files will contain the Chrome User Experience Report (CrUX) field data for every succesful test with results. The metrics extarcted are:

- First Contentful Paint in miliseconds (FCP)
- First Input Delay in miliseconds (FID)
- Largest Contentful Paint in miliseconds (LCP)
- Cummulative Layout Shift (CLS)

In some cases, the is no CrUX data for the URLs specified in the 'urls.csv'. For these cases, the script will try to extract the origin domain data (aggregation of all URLs from that domain). If there is no origin data, no files will be created.
