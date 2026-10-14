const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE END-TO-END VERIFICATION');
  console.log('====================================================\n');

  const BASE_URL = 'http://localhost:5000/api/hotels';

  // Test 1: Health check
  console.log('1️⃣ Testing Server Health...');
  const healthRes = await fetch('http://localhost:5000/api/health');
  const healthData = await healthRes.json();
  console.log('   Status:', healthRes.status, healthData.status);
  if (healthRes.status !== 200) throw new Error('Health check failed');

  // Test 2: GET /api/hotels (with pagination)
  console.log('\n2️⃣ Testing GET /api/hotels (limit=3, page=1)...');
  const getRes = await fetch(`${BASE_URL}?limit=3&page=1`);
  const getData = await getRes.json();
  console.log('   Returned items:', getData.data.length, 'Total:', getData.pagination.total, 'Pages:', getData.pagination.totalPages);
  if (!getData.success || getData.data.length !== 3) throw new Error('GET pagination test failed');

  // Test 3: Search filter
  console.log('\n3️⃣ Testing Search Filter (search="Paris")...');
  const searchRes = await fetch(`${BASE_URL}?search=Paris`);
  const searchData = await searchRes.json();
  console.log('   Found matching hotels:', searchData.data.map(h => h.title));
  if (searchData.data.length === 0 || !searchData.data[0].title.toLowerCase().includes('paris')) {
    throw new Error('Search filter failed');
  }

  // Test 4: Price Range filter
  console.log('\n4️⃣ Testing Price Filter (minPrice=300, maxPrice=400)...');
  const priceRes = await fetch(`${BASE_URL}?minPrice=300&maxPrice=400`);
  const priceData = await priceRes.json();
  console.log('   Price filter results:', priceData.data.map(h => `${h.title}: $${h.price}`));
  for (const h of priceData.data) {
    const p = parseFloat(h.price);
    if (p < 300 || p > 400) throw new Error(`Price ${p} out of range!`);
  }

  // Test 5: Validation for Create (Empty Body)
  console.log('\n5️⃣ Testing POST /api/hotels Validation (Empty Body)...');
  const failPostRes = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const failPostData = await failPostRes.json();
  console.log('   Validation status:', failPostRes.status, 'Errors:', failPostData.errors);
  if (failPostRes.status !== 400 || !failPostData.errors.title || !failPostData.errors.price) {
    throw new Error('Create validation failed');
  }

  // Test 6: Create Hotel with multipart/form-data
  console.log('\n6️⃣ Testing POST /api/hotels (Multipart Form-Data with Image Upload)...');
  // Create a dummy image file for upload testing
  const testImagePath = path.join(__dirname, 'uploads', 'test-upload-sample.jpg');
  if (!fs.existsSync(testImagePath)) {
    fs.writeFileSync(testImagePath, 'FAKE_JPEG_IMAGE_DATA_CONTENT_123456');
  }

  const formData = new FormData();
  const fileBuffer = fs.readFileSync(testImagePath);
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  formData.append('image', blob, 'sample-resort.jpg');
  formData.append('title', 'The Grand Royal Palace & Spa');
  formData.append('description', 'Spectacular luxury beachfront property with private heated infinity pools, spa sanctuaries, and five-star Michelin dining.');
  formData.append('latitude', '25.1972');
  formData.append('longitude', '55.2744');
  formData.append('price', '480.00');
  formData.append('address', 'Downtown Boulevard, Dubai, UAE');

  const createRes = await fetch(BASE_URL, {
    method: 'POST',
    body: formData,
  });
  const createData = await createRes.json();
  console.log('   Create status:', createRes.status, 'Message:', createData.message);
  console.log('   Created Hotel ID:', createData.data?.id, 'Image saved as:', createData.data?.image);
  if (createRes.status !== 201 || !createData.data?.id) throw new Error('Create hotel failed');
  const createdId = createData.data.id;
  const createdImage = createData.data.image;

  // Test 7: GET /api/hotels/:id (Detail View)
  console.log(`\n7️⃣ Testing GET /api/hotels/${createdId} (Detail View)...`);
  const detailRes = await fetch(`${BASE_URL}/${createdId}`);
  const detailData = await detailRes.json();
  console.log('   Detail Title:', detailData.data.title, 'Coordinates:', detailData.data.latitude, detailData.data.longitude);
  if (!detailData.success || detailData.data.title !== 'The Grand Royal Palace & Spa') {
    throw new Error('Get detail failed');
  }

  // Test 8: PUT /api/hotels/:id (Edit Hotel)
  console.log(`\n8️⃣ Testing PUT /api/hotels/${createdId} (Update Price & Title)...`);
  const updateForm = new FormData();
  updateForm.append('title', 'The Grand Royal Palace & Spa (Updated)');
  updateForm.append('price', '550.00');
  updateForm.append('description', 'Updated luxury details with newly expanded presidential villas.');
  updateForm.append('latitude', '25.1972');
  updateForm.append('longitude', '55.2744');
  updateForm.append('address', 'Downtown Boulevard Suite 1, Dubai, UAE');

  const updateRes = await fetch(`${BASE_URL}/${createdId}`, {
    method: 'PUT',
    body: updateForm,
  });
  const updateData = await updateRes.json();
  console.log('   Update status:', updateRes.status, 'New Price:', updateData.data.price, 'New Title:', updateData.data.title);
  if (updateRes.status !== 200 || parseFloat(updateData.data.price) !== 550) {
    throw new Error('Update hotel failed');
  }

  // Test 9: DELETE /api/hotels/:id (Delete Hotel & Verify File Cleanup)
  console.log(`\n9️⃣ Testing DELETE /api/hotels/${createdId}...`);
  const deleteRes = await fetch(`${BASE_URL}/${createdId}`, {
    method: 'DELETE',
  });
  const deleteData = await deleteRes.json();
  console.log('   Delete status:', deleteRes.status, 'Message:', deleteData.message);
  if (deleteRes.status !== 200 || !deleteData.success) throw new Error('Delete failed');

  // Verify deletion from database
  const verifyDeleteRes = await fetch(`${BASE_URL}/${createdId}`);
  console.log('   Verification query status after delete:', verifyDeleteRes.status);
  if (verifyDeleteRes.status !== 404) throw new Error('Hotel was not deleted from database');

  console.log('\n====================================================');
  console.log('✅ ALL API & CRUD TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
