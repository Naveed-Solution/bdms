/**
 * Test script to verify Photon API (OpenStreetMap) is working
 * Run: node test-photon-api.js
 */

async function testPhotonAPI() {
  const testQueries = [
    'jinnah',
    'lahore',
    'hospital',
    'islamabad'
  ];

  console.log('🧪 Testing Photon API (OpenStreetMap Geocoding)...\n');

  for (const query of testQueries) {
    console.log(`\n🔍 Searching for: "${query}"`);
    console.log('─'.repeat(50));

    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=3&lang=en&countrycodes=pk`;
      console.log('URL:', url);

      const response = await fetch(url);
      console.log('Status:', response.status, response.statusText);

      if (!response.ok) {
        console.error('❌ HTTP Error:', response.status);
        continue;
      }

      const data = await response.json();
      console.log('Features found:', data.features ? data.features.length : 0);

      if (data.features && data.features.length > 0) {
        console.log('\n✅ Results:');
        data.features.slice(0, 3).forEach((feature, i) => {
          const props = feature.properties;
          const coords = feature.geometry.coordinates;
          const addressParts = [
            props.name,
            props.street,
            props.city || props.district,
            props.state,
            props.country
          ].filter(Boolean);

          console.log(`\n  [${i + 1}] ${addressParts.join(', ')}`);
          console.log(`      Coordinates: ${coords[1]}, ${coords[0]}`);
          console.log(`      OSM Type: ${props.osm_type}`);
        });
      } else {
        console.log('⚠️  No results found');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Test complete!');
}

// Run the test
testPhotonAPI().catch(console.error);

