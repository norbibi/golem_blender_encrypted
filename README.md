# Golem Blender encrypted

The goal of this repository is to show how to send/receive encrypted data to/from a Golem's provider to avoid data leaks.

First, we generate an aes-128 key then send it to the provider via SSH so that it cannot be intercepted.
Datas are encrypted and sent to the provider's receiving volume, then moved to RAM and decrypted before calculation (in RAM).  
The result is encrypted and moved to the sending volume for requestor retrieving.  
For remendir, even if provider can see the SSH password used in log, this password can't be used by anyone excepted by the requestor who is in the VPN.

This application is only for Linux requestor.

**Requirements**

  - Yagna requestor

System packages:
  - openssh-client
  - sshpass
  - openssl
  - websocat
  - nodejs

Node packages:
  - @golem-sdk/golem-js
  - commander

**How to use:**
``` 
sudo npm install -g @golem-sdk/golem-js commander
git clone https://github.com/norbibi/golem_blender_encrypted.git  
cd golem_blender_encrypted  
node blender_encrypted.mjs --providerid 0x50a6612d55f95ea34f3f82b189ee33dba34c44c4  
```
