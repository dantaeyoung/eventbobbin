import { fetchInstagramPost, extractEventFromInstagram, extractShortcode } from '../src/lib/scraper/instagram';

async function main() {
  const url = process.argv[2] || 'https://www.instagram.com/p/DT1Cyn9gIZF/';

  console.log('Testing Instagram scraper...');
  console.log('URL:', url);
  console.log('Shortcode:', extractShortcode(url));
  console.log('');

  const postData = await fetchInstagramPost(url);

  if (postData) {
    console.log('=== Post Data ===');
    console.log('Username:', postData.ownerUsername);
    console.log('Caption:', postData.caption.substring(0, 500) + (postData.caption.length > 500 ? '...' : ''));
    console.log('Image URL:', postData.displayUrl?.substring(0, 100) + '...');
    console.log('Is Video:', postData.isVideo);
    console.log('Likes:', postData.likeCount);
    console.log('Comments:', postData.commentCount);
    if (postData.location) {
      console.log('Location:', postData.location.name);
    }
    if (postData.carouselMedia) {
      console.log('Carousel items:', postData.carouselMedia.length);
    }
    console.log('');

    // Also test the event extraction
    console.log('=== Extracted Event Info ===');
    const eventInfo = await extractEventFromInstagram(url);
    if (eventInfo) {
      console.log('Title:', eventInfo.title);
      console.log('Location:', eventInfo.location || '(none)');
    }
  } else {
    console.log('Failed to fetch post data');
  }
}

main().catch(console.error);
