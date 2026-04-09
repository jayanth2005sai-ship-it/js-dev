import si from 'systeminformation';
import os from 'os';
async function test() {
  const fsStats = await si.fsSize();
  const mainDisk = fsStats.find(d => d.fs !== 'none' && d.type !== 'overlay') || fsStats[0] || { use: 0, used: 0, size: 0 };
  let size = mainDisk.size;
  let used = mainDisk.used;
  if (size > 1024 * 1024 * 1024 * 1024 * 100) {
    size = Math.max(os.totalmem(), used * 1.5, 1024 * 1024 * 1024 * 4);
  }
  const diskUsagePercent = size > 0 ? Math.round((used / size) * 100) : 0;
  const diskUsedGB = (used / 1024 / 1024 / 1024).toFixed(2);
  const diskTotalGB = (size / 1024 / 1024 / 1024).toFixed(2);
  console.log({ diskUsagePercent, diskUsedGB, diskTotalGB });
}
test();
