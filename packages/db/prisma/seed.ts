import { prisma } from "../src/index";

/** Dev seed (S02): a workspace, an agent, and a contact (with an email identity) + a conversation. */
async function main() {
  const ws = await prisma.workspace.upsert({
    where: { id: "demo-ws" },
    update: {},
    create: { id: "demo-ws", name: "Demo Support" },
  });

  await prisma.agent.upsert({
    where: { workspaceId_email: { workspaceId: ws.id, email: "agent@demo.dev" } },
    update: {},
    create: { workspaceId: ws.id, email: "agent@demo.dev", name: "Alex Agent", role: "admin" },
  });

  const contact = await prisma.contact.upsert({
    where: { id: "demo-contact" },
    update: {},
    create: {
      id: "demo-contact",
      workspaceId: ws.id,
      name: "Dana Customer",
      identities: { create: { workspaceId: ws.id, type: "email", value: "dana@example.com", verified: true } },
    },
  });

  const convo = await prisma.conversation.upsert({
    where: { id: "demo-convo" },
    update: {},
    create: { id: "demo-convo", workspaceId: ws.id, subject: "How do I reset my password?", contactId: contact.id },
  });
  await prisma.message.upsert({
    where: { id: "demo-msg" },
    update: {},
    create: {
      id: "demo-msg",
      conversationId: convo.id,
      direction: "inbound",
      raw: "Hi, I can't reset my password — the email never arrives. Help?",
      parsed: "Hi, I can't reset my password — the email never arrives. Help?",
    },
  });
  console.log("seeded workspace + agent + contact + conversation");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
