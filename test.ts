import si from 'systeminformation';
async function test() {
  const fsStats = await si.fsSize();
  console.log(JSON.stringify(fsStats, null, 2));
}
test();
