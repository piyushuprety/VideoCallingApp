let APP_ID = '230837fc2e5b49c8a949b409070f334d';
let localStream;
let remoteStream;
let pc;

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

if (!roomId) {
  window.location = 'lobby.html';
}

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.1.google.com:19302', 'stun:stun2.1.google.com:19302'],
    },
  ],
};

let constraints = {
  video: {
    width: { min: 640, ideal: 1920, max: 1920 },
    height: { min: 0, ideal: 1080, max: 1080 },
  },
  audio: true,
};

let init = async () => {
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });

  channel = client.createChannel(roomId);
  await channel.join();

  channel.on('MemberJoined', async (MemberId) => {
    console.log('New User Joined', MemberId);
    createOffer(MemberId);
  });

  channel.on('MemberLeft', () => {
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');
  });

  client.on('MessageFromPeer', async (message, MemberId) => {
    message = JSON.parse(message.text);
    if (message.type === 'offer') createAnswer(MemberId, message.offer);
    if (message.type === 'answer') addAnswer(message.answer);
    if (message.type === 'candidate')
      if (pc) pc.addIceCandidate(message.candidate);
  });

  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  document.getElementById('user-1').srcObject = localStream;
};

let createPC = async (MemberId) => {
  pc = new RTCPeerConnection(servers); //Creating connection

  remoteStream = new MediaStream();
  document.getElementById('user-2').srcObject = remoteStream; //gathering data and sending to frontend
  document.getElementById('user-2').style.display = 'block'; //view the 2nd window when user 2 joins
  document.getElementById('user-1').classList.add('smallFrame'); //video of 1nd user will shrink

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById('user-1').srcObject = localStream;
  }

  localStream.getTracks().forEach((track) => {
    //loops through the local media stream and send it to other peer
    pc.addTrack(track, localStream);
  });

  pc.ontrack = (e) => {
    e.streams[0].getTracks().forEach((track) => {
      //listening to the remote media stream of the other peer
      remoteStream.addTrack(track);
    });
  };

  pc.onicecandidate = async (e) => {
    //setting up ICE candidates and SDP .....  calls repeatedly for getting the ice candidates
    if (e.candidate) {
      client.sendMessageToPeer(
        { text: JSON.stringify({ type: 'candidate', candidate: e.candidate }) },
        MemberId
      );
    }
  };
};

let createOffer = async (MemberId) => {
  await createPC(MemberId);

  let offer = await pc.createOffer();
  await pc.setLocalDescription(offer); //set local description fires the ice candiantes

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: 'offer', offer: offer }) },
    MemberId
  );
};

let createAnswer = async (MemberId, offer) => {
  await createPC(MemberId);

  await pc.setRemoteDescription(offer);

  let answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: 'answer', answer: answer }) },
    MemberId
  );
};

let addAnswer = async (answer) => {
  if (!pc.currentRemoteDescription) pc.setRemoteDescription(answer);
};

let toggleCamera = async () => {
  let videoTrack = localStream
    .getTracks()
    .find((track) => track.kind === 'video');

  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    document.getElementById('camera-btn').style.borderColor = 'red';
  } else {
    videoTrack.enabled = true;
    document.getElementById('camera-btn').style.borderColor = 'green';
  }
};

let toggleMic = async () => {
  let audioTrack = localStream
    .getTracks()
    .find((track) => track.kind === 'audio');

  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.getElementById('mic-btn').style.borderColor = 'red';
  } else {
    audioTrack.enabled = true;
    document.getElementById('mic-btn').style.borderColor = 'green';
  }
};

window.addEventListener('beforeunload', async () => {
  await channel.leave();
  await client.logout();
});

document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();
