import 'dotenv/config';
import { scrapeAll } from '../src/lib/scraper';

scrapeAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
