const { spawn } = require('child_process');
const ps = require('ps-node');
const pm2 = require('pm2');
const path = require('path');

/**
 * Initialize monitor module
 *
 * @param {Object} options - Options
 * @param {String} options.name - Server Name
 * @param {Number} options.port - Server Port Number
 * @example 
 * monitor({
 *                  name: 'server001',
 *                  port: 3001
 * });
 */
function index ({ name, port }) {
    if (!port) {
        console.error('pm2-server-monitor requires port!');
        process.exit();
    }
    if (!name) {
        console.error('pm2-server-monitor requires name!');
        process.exit();
    }

    // Primeiro, descubra se o processo existe e continue a criá-lo, caso ainda não exista
    ps.lookup({
        command: 'node',
        arguments: ['--monitport', port, '--monitname', name],
    }, (err, resultList) => {
        if (err) {
            return console.error(err);
        }

        if (resultList && Array.isArray(resultList) && resultList.length > 0) {
            // Explique que existe um processo
            console.log(`God process (pid ${resultList[0].pid}) already exists, continue to be used.`);
        } else {
            const currentPid = process.pid;
            pm2.list((err, data) => {
                if (err) {
                    return console.error(err);
                }
                if (data && Array.isArray(data) && data.length > 0) {
                    // De acordo com o processo atual, descubra as informações sobre o processo criado pelo pm2
                    const currentProcess = data.find(process => process.pid === currentPid);
                    if (currentProcess) {
                        // Baseado no fato: o mesmo script de execução do projeto deve ser o mesmo, 
                        // e o processo de execução do mesmo script também deve ser o mesmo projeto
                        const execPath = currentProcess.pm2_env.pm_exec_path;
                        const projectProcesses = data.filter(process => process.pm2_env.pm_exec_path === execPath);
                        if (projectProcesses[0].pid === currentPid) {
                            // O processo atual é o primeiro processo entre todos os processos do mesmo projeto criado pelo pm2, 
                            // antes da desova, para garantir que haja apenas um processo, mesmo em modo de cluster
                            return spawnGod(execPath);
                        }
                    }
                }
            });
        }
    });

    function spawnGod(execPath) {
        console.log('God process does not exist, will create the process!');
        const godScript = path.join(__dirname, './god.js');

        // --monitport Na verdade, é um identificador especial, que é conveniente para encontrar o processo
        const god = spawn('node', [godScript, '--monitport', port, '--monitname', name, execPath], {
            slient: true,
            detached: true,
            // stdio: 'ignore'
        });
        console.log(`God process was successfully created! pid ${god.pid}.`);
        god.unref();
        god.stdout.on('data', data => console.log(data.toString()));
        god.stderr.on('data', data => console.log(data.toString()));
    }
};
module.exports = index;
