import { TaskExecutor } from "@golem-sdk/golem-js";
import { program, Option } from "commander";
import crypto from "crypto";
import { execSync } from "child_process";

const appKey = process.env["YAGNA_APPKEY"];

function range(start, stop, step) {
  var res = [];
  var i = start;
  while (i<stop) {
    res.push(i);
    i += step;
  }
  return res;
}

async function main(subnet, payment_driver, payment_network, providerid, scene, format, start_frame, stop_frame, step_frame, output_dir) {

  let frames = range(start_frame, stop_frame + 1, step_frame);
  let ssh_password = crypto.randomBytes(40).toString("hex");
  let aes_password = crypto.randomBytes(40).toString("hex");

  let ext;
  if(format in ["OPEN_EXR_MULTILAYER", "OPEN_EXR"])
        ext = "exr";
    else
        ext = format.toLowerCase();

  let propFilter = undefined
  if(providerid != "")
    propFilter = async (proposal) => {
      var decision = false;
      if(proposal.provider.id == providerid)
          decision = true;
      return decision;
    };

  const executor = await TaskExecutor.create({
    subnetTag: subnet,
    payment: { driver: payment_driver, network: payment_network },
    package: "de461c2ede6c1e496f6978a822f277354747bbfe42892f008f394a7f",
    maxParallelTasks: 1,
    proposalFilter: propFilter,
    capabilities: ["vpn", "!exp:gpu"],
    engine: "vm-nvidia",
    networkIp: "192.168.0.0/24",
    taskTimeout: 60*60*1000,
  });

  execSync(`echo ${aes_password} > datas/aes_password`);
  execSync(`openssl enc -aes-256-cbc -kfile datas/aes_password -pbkdf2 -in ${scene} -out datas/scene.blend.enc`);

  try {
    executor.onActivityReady(async (ctx) => {
      let cmd_display = "PCIID=$(nvidia-xconfig --query-gpu-info | grep 'PCI BusID' | awk -F'PCI BusID : ' '{print $2}') && (nvidia-xconfig --busid=$PCIID --use-display-device=none --virtual=1280x1024 || true) && ((Xorg :1 &) || true) && sleep 5"
      await ctx
        .beginBatch()
        .run("syslogd")
        .run("ssh-keygen -A")
        .run(`echo '${ssh_password}\n${ssh_password}' | passwd`)
        .run("/usr/sbin/sshd")
        .run(cmd_display)
        .uploadFile("datas/scene.blend.enc", "/golem/resources/scene.blend.enc")
        .end()

      execSync(`sshpass -p ${ssh_password} scp -o 'StrictHostKeyChecking no' -o ProxyCommand='websocat asyncstdio: ${ctx.getWebsocketUri(22)} --binary -H=Authorization:"Bearer ${appKey}"' datas/aes_password root@${crypto.randomBytes(10).toString("hex")}:/tmp/aes_password`);

      await ctx
        .beginBatch()
        .run("mv /golem/resources/scene.blend.enc /tmp/scene.blend.enc")
        .run("openssl enc -aes-256-cbc -pbkdf2 -kfile /tmp/aes_password -d -in /tmp/scene.blend.enc -out /tmp/scene.blend")
        .end()
    });

    let future_results = frames.map((frame) => executor.run(async (ctx) => {

      executor.networkService.network.nodes.delete(ctx.options.networkNode.id);

      let frame_number_as_string = `${frame.toString()}`;
      let filename = `${frame_number_as_string.padStart(4, "0")}`;
      let full_filename = `${filename}.${ext}`;
      let full_enc_filename = `${full_filename}.enc`;
      let cmd_render = `(DISPLAY=:1 blender -b /tmp/scene.blend -o /tmp/ -noaudio -F ${format} -f ${frame_number_as_string} -- --cycles-device CUDA)`
      await ctx
        .beginBatch()
        .run(cmd_render)
        .run(`openssl enc -aes-256-cbc -kfile /tmp/aes_password -pbkdf2 -in /tmp/${full_filename} -out /golem/output/${full_enc_filename}`)
        .downloadFile(`/golem/output/${full_enc_filename}`, `datas/${full_enc_filename}`)
        .end()

      execSync(`openssl enc -aes-256-cbc -pbkdf2 -kfile datas/aes_password -d -in datas/${full_enc_filename} -out datas/${full_filename} && rm datas/${full_enc_filename}`)
    }));

    await Promise.all(future_results);

  } finally {
    await executor.shutdown();
  }
}

program
  .option("--subnet <subnet>", "subnet", "public")
  .option("--paymentdriver <paymentdriver>", "paymentdriver", "erc20")
  .option("--paymentnetwork <paymentnetwork>", "paymentnetwork", "polygon")
  .option("--providerid <providerid>", "providerid", "")
  .option("--scene <scene>", "scene", "cubes.blend")
  .addOption(new Option("--format <format>", "format").choices(["PNG", "BMP", "JPEG", "OPEN_EXR", "OPEN_EXR_MULTILAYER"]).default("PNG"))
  .option("--startframe <startframe>", "startframe", Number, 1)
  .option("--stopframe <stopframe>", "stopframe", Number, 5)
  .option("--stepframe <stepframe>", "stepframe", Number, 1)
  .option("--outputdir <outputdir>", "outputdir", "./")

program.parse();
const options = program.opts();

main(options.subnet, options.paymentdriver, options.paymentnetwork, options.providerid, options.scene, options.format, options.startframe, options.stopframe, options.stepframe, options.outputdir);

// node blender_encrypted.mjs --providerid 0x50a6612d55f95ea34f3f82b189ee33dba34c44c4