import express, { Express, Request, Response } from 'express';
import { Prisma, PrismaClient } from "@prisma/client";
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { SubmittedProof } from '@reclaimprotocol/reclaim-sdk';
import { initializeApp } from 'firebase-admin/app';

dotenv.config();

const app: Express = express();
app.use(express.json());

const port = process.env.PORT;
const prisma = new PrismaClient();

const firebaseApp = initializeApp();

app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server');
});

app.post('/initiateHandshake', async (req: Request, res: Response) => {
  console.log(req.body);
  const { templateLink, fcmToken } = req.body;
  const sessionId = uuidv4();
  const session = await prisma.sessions.create({
    data: {
      session1: {
        create: {
          sessionId: sessionId,
          templateLink: templateLink,
          fcmToken: fcmToken,
          proofs: []
        }
      },
      session2: {
        create: {
          sessionId: '',
          templateLink: '',
          fcmToken: '',
        }
      }
    }
  })

  res.status(200).send({ message: 'Initiated Handshake', id: session.id, sessionId: session.sessionId1 });
})

app.post('/acceptHandshake', async (req: Request, res: Response) => {
  console.log(req.body);
  const { id, templateLink, fcmToken } = req.body;
  const sessionId = uuidv4();
  const session = await prisma.sessions.update({
    where: {
      id: id
    },
    data: {
      session2: {
        create: {
          sessionId: sessionId,
          templateLink: templateLink,
          fcmToken: fcmToken,
          proofs: []
        }
      }
    }
  })
  res.status(200).send({ message: 'Accepted Handshake', id, sessionId: session.sessionId2 });
})

app.post('/addProof', async (req: Request, res: Response) => {
  const { id, sessionId, proofs } = req.body;

  const receivedProofs: SubmittedProof[] | undefined = proofs
  // check if proofs are already present
  const session = await prisma.session.findUnique({
    where: {
      id: sessionId
    },
  })
  console.log('session fetched ----', session)
  if (session?.proofs && session?.proofs.length > 0) {
    // revert if proofs are already present
    res.status(400).send({ message: 'Proofs already submitted' });
    return;
  }
  // add proofs to session
  await prisma.session.update({
    where: {
      id: sessionId
    },
    data: {
      proofs: receivedProofs
    }
  })

  const sessions = await prisma.sessions.findUnique({
    where: {
      id: id
    },
  })
  console.log('parent session fetched ----', sessions)
  if (sessions?.sessionId1) {
    // check if session1 and session2 have submitted proofs
    // get proofs from session1
    const session1 = await prisma.session.findUnique({
      where: {
        id: sessions.sessionId1
      },
    })
    console.log('session1Proofs fetched ----', session1)
    // get proofs from session2
    const session2 = await prisma.session.findUnique({
      where: {
        id: sessions.sessionId2
      },
    })
    console.log('session2Proofs fetched ----', session2)
    if (session1?.proofs && session2?.proofs && session1?.proofs.length > 0 && session2?.proofs.length > 0) {
      // send notification to both session1 and session2
      console.log('send notification to both session1 and session2')
    }
  } else {
    // send notification to session1
    console.log('send notification to session1')
  }
  res.status(200).send({ message: 'Proofs submitted' });
})

// server sent events that checks if proofs are submitted for both session1 and session2
app.get('/checkProofs', async (req: Request, res: Response) => {
  const { id } = req.query;
  const sessions = await prisma.sessions.findUnique({
    where: {
      id: id as string
    },
  })
  console.log('parent session fetched ----', sessions)
  if (sessions?.sessionId1 && sessions?.sessionId2) {
    // check if session1 and session2 have submitted proofs
    // get proofs from session1
    const session1 = await prisma.session.findUnique({
      where: {
        id: sessions.sessionId1
      },
    })
    console.log('session1 fetched ----', session1)
    // get proofs from session2
    const session2 = await prisma.session.findUnique({
      where: {
        id: sessions.sessionId2
      },
    })
    console.log('session2 fetched ----', session2)
    if (session1?.proofs && session2?.proofs && session1?.proofs.length > 0 && session2?.proofs.length > 0) {
      res.send({ message: 'Proofs submitted by both parties', sessionProofs1: session1.proofs, sessionProofs2: session2.proofs });
    }
  } else {
    res.status(400).send({ message: 'Proofs not submitted by both parties' });
  }
})

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
