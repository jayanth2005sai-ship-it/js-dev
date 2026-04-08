import si from 'systeminformation';
si.diskLayout().then(data => console.log(JSON.stringify(data, null, 2)));
