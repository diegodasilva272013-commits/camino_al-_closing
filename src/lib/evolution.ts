import { createSupabaseAdminClient } from './supabase-server';

export type EvolutionInstance = {
  id: string;
  name: string;
  instance_key: string;
  api_url: string;
  api_token: string;
  status: string;
  phone_number: string | null;
};

async function getHeaders(token: string) {
  return { 'Content-Type': 'application/json', apikey: token };
}

export async function evolutionSendText(instance: EvolutionInstance, phone: string, text: string) {
  const normalized = phone.replace(/\D/g, '');
  const res = await fetch(`${instance.api_url}/message/sendText/${instance.instance_key}`, {
    method: 'POST',
    headers: await getHeaders(instance.api_token),
    body: JSON.stringify({ number: normalized, text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Evolution sendText failed: ${err}`);
  }
  return res.json();
}

export async function evolutionGetQR(instance: EvolutionInstance) {
  const res = await fetch(`${instance.api_url}/instance/connect/${instance.instance_key}`, {
    headers: await getHeaders(instance.api_token),
  });
  if (!res.ok) throw new Error('Failed to get QR');
  return res.json() as Promise<{ base64?: string; code?: string; status?: string }>;
}

export async function evolutionCheckStatus(instance: EvolutionInstance) {
  const res = await fetch(`${instance.api_url}/instance/connectionState/${instance.instance_key}`, {
    headers: await getHeaders(instance.api_token),
  });
  if (!res.ok) throw new Error('Failed to check status');
  return res.json() as Promise<{ instance?: { state: string; profileName?: string; wuid?: string } }>;
}

export async function evolutionCreateInstance(apiUrl: string, apiToken: string, instanceKey: string) {
  const res = await fetch(`${apiUrl}/instance/create`, {
    method: 'POST',
    headers: await getHeaders(apiToken),
    body: JSON.stringify({ instanceName: instanceKey, qrcode: true }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create instance: ${err}`);
  }
  return res.json();
}

export async function evolutionDeleteInstance(instance: EvolutionInstance) {
  await fetch(`${instance.api_url}/instance/delete/${instance.instance_key}`, {
    method: 'DELETE',
    headers: await getHeaders(instance.api_token),
  });
}

export async function getEvolutionInstance(instanceId: string): Promise<EvolutionInstance | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await (admin as any).from('evolution_instances').select('*').eq('id', instanceId).single();
  return data ?? null;
}
