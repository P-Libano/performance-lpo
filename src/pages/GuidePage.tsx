import type { ReactNode } from 'react'
import { RpeGuideTable } from '../components/BarTools'
import { Screen } from '../components/ui'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-ink/85">{children}</div>
    </section>
  )
}

function Table({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <thead className="text-left text-xs text-muted">
        <tr>
          <th className="py-1 font-normal">{head[0]}</th>
          <th className="py-1 font-normal">{head[1]}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map(([a, b]) => (
          <tr key={a}>
            <td className="py-1.5 pr-3 font-medium">{a}</td>
            <td className="py-1.5 text-ink/85">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function GuidePage() {
  return (
    <Screen title="Entenda 1RM, RPE e volume" back>
      <Section title="1RM — uma repetição máxima">
        <p>
          O peso máximo que você levanta <strong>uma vez</strong>, com boa execução. Se no supino 100 kg sobe uma vez e não sai a
          segunda, seu 1RM é 100 kg — e “80% do 1RM” seriam 80 kg.
        </p>
        <p>
          Você não precisa testar o máximo. O app <strong>estima</strong> a partir de uma série normal: quem faz 80 kg × 8 tem um
          1RM perto de 100 kg.
        </p>
        <Table
          head={['% do 1RM', 'Reps que cabem (aprox.)']}
          rows={[
            ['85–95%', '1–5 · força'],
            ['67–80%', '8–12 · hipertrofia'],
            ['50–65%', '15–20+ · resistência'],
          ]}
        />
      </Section>

      <Section title="RPE — esforço percebido">
        <p>
          Uma nota de 1 a 10 para o quão pesada foi a série, dada logo depois de terminar. Pense: <em>quantas reps ainda sobravam?</em>
        </p>
        <RpeGuideTable />
        <p className="text-muted">RIR = repetições em reserva (as que ainda sobravam).</p>
        <p>
          O 1RM é a régua fixa; o RPE mostra como você está <strong>hoje</strong>. Os mesmos 80 kg podem ser RPE 9 depois de uma
          noite ruim e RPE 7 num dia bom. No começo é comum dar nota alta demais — a calibração melhora em poucas semanas.
        </p>
      </Section>

      <Section title="As contas do app">
        <p>
          <strong>1RM estimado (Epley):</strong> peso × (1 + reps ÷ 30). Se você informou RPE, as reps que sobravam entram na conta:
          60 kg × 8 em RPE 8 conta como 60 × (1 + 10 ÷ 30) = 80 kg. Usa a melhor série da última sessão de carga (deload não
          conta) e ignora séries acima de 12 reps quando há outra mais pesada.
        </p>
        <p>
          <strong>De volta para kg:</strong> com %1RM, é 1RM × %. Sem %1RM, a conta inverte: 1RM ÷ (1 + (reps + reps em reserva) ÷
          30). Tudo arredondado para 0,5 kg.
        </p>
        <p>
          <strong>Primeira vez num exercício:</strong> informe um peso e quantas reps você faz com ele; o app sugere a carga de
          partida pelo meio da faixa prescrita.
        </p>
        <p>
          <strong>Próxima sessão:</strong> quem decide subir, manter ou reduzir é a regra do seu objetivo (abaixo). A conta do 1RM
          aparece ao lado só para você ver onde a sugestão cai.
        </p>
      </Section>

      <Section title="Como cada objetivo progride">
        <Table
          head={['Objetivo', 'Regra']}
          rows={[
            ['Força', 'Todas as reps com RPE até 7 → sobe 2,5 kg (superiores) ou 5 kg (inferiores). RPE 8–9 → mantém. Acima de 9 ou reps abaixo do mínimo → reduz 5%.'],
            ['Força + hipertrofia', 'O exercício principal segue a regra de força; os demais, a de hipertrofia.'],
            ['Hipertrofia', 'Dupla progressão: primeiro chega ao topo da faixa de reps em todas as séries, depois sobe a carga. Duas sessões sem progresso → deload de 10%.'],
            ['Gasto energético', 'Densidade: menos descanso, depois mais uma série, só então mais carga.'],
            ['Resistência', 'Mais reps com a mesma carga até o topo da faixa; aí sobe a carga e volta ao início.'],
          ]}
        />
        <p className="text-muted">Isoladores sobem em passos menores: 1 kg (superiores) ou 2,5 kg (inferiores).</p>
      </Section>

      <Section title="Volume levantado">
        <p>
          Soma de peso × reps de todas as séries concluídas. 3 séries de 10 com 60 kg = 1.800 kg. Aparece no fim de cada treino
          (comparado com a última vez do mesmo dia) e no Histórico, por semana.
        </p>
        <p className="text-muted">
          Exercícios de peso corporal entram como 0 kg. Volume subindo ao longo das semanas é um bom sinal; uma queda na semana de
          deload é esperada.
        </p>
      </Section>
    </Screen>
  )
}
