import { prisma } from "../src/index";

/** Dev seed (S01): one contact with a conversation + message, so the inbox has something to show. */
async function main() {
  const contact = await prisma.contact.upsert({
    where: { id: "demo-contact" },
    update: {},
    create: { id: "demo-contact", name: "Dana Customer", email: "dana@example.com" },
  });
  const convo = await prisma.conversation.upsert({
    where: { id: "demo-convo" },
    update: {},
    create: { id: "demo-convo", subject: "How do I reset my password?", contactId: contact.id },
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
  console.log("seeded a demo conversation");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
