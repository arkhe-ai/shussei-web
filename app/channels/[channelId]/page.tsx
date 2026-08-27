import { AppShell } from '../../../components/app-shell';

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  return <AppShell initialChannelId={channelId} />;
}
