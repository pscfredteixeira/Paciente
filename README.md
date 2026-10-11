# Meu Consultório — Sprint 2 (protótipo UX)

App de gestão administrativa de consultas e pagamentos para uso pessoal, com foco no iPhone.

## Testar a demonstração

Abra `index.html` no navegador. Os dados de pacientes, sessões e valores são **inventados**.

1. Entre na Agenda, selecione 13 de outubro e abra a sessão de Marina A.
2. Escolha **Marcar como realizada** e revise o valor antes de confirmar.
3. No Financeiro, registre um pagamento Pix fictício de R$ 100 para Marina A. e revise o saldo.
4. Em Pacientes, consulte o extrato e as sessões ligadas à paciente.
5. Na Agenda de 14 de outubro, vincule o evento sem paciente a um cadastro fictício.
6. Em Ajustes, é possível visualizar a tela de login ainda não funcional e reiniciar a demonstração.

## Recursos da fase visual

- Identidade visual roxa com detalhes em laranja, aprovada em 11/10/2026.
- Tela inicial com pendências de atenção.
- Agenda com filtros (todas, a confirmar, realizadas, sem vínculo).
- Confirmações antes de alterar sessões e lançar débitos.
- Distinção entre débito da sessão e pagamento recebido.
- Lançamento financeiro fictício parcial e aviso de crédito quando há pagamento excedente.
- Histórico por paciente e extrato de movimentações.
- Layout adaptado para desktop e celular.

## Segurança

**Este repositório é público e contém apenas um protótipo. Nunca coloque nele dados reais de pacientes, tokens, credenciais ou comprovantes.**

Não existe login real, banco de dados, integração com Google Calendar, banco ou Pix. As simulações ficam na memória do navegador e desaparecem ao atualizar a página.

Os dados reais só poderão ser usados depois da implantação de autenticação exclusiva, backend seguro, permissões no servidor e proteções adequadas à LGPD.

O escopo do projeto está em [ESCOPO.md](ESCOPO.md).
