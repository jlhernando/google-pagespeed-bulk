/* Modules */
import axios from 'axios';

/* API Parameters */
const endpoint =
  'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed'; // Endpoint
const key = ''; // API Key (https://developers.google.com/speed/docs/insights/v5/get-started)

// Custom function to request PageSpeed API
export const apiRequest = async (url, device) => {
  const { data } = await axios(
    `${endpoint}?url=${url}&strategy=${device}&key=${key}`
  );
  return data;
};
