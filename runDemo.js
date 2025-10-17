const createCompleteDemo = require('./createCompleteDemo');

console.log('Starting demo data creation...');
createCompleteDemo().then(() => {
  console.log('Demo data creation completed!');
  process.exit(0);
}).catch(error => {
  console.error('Demo data creation failed:', error);
  process.exit(1);
});