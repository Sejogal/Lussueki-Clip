import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: { width: '100%', height: '100%', alignSelf: 'center' },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    zIndex: 10,
  },
  backButtonInline: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  errorButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  retryButton: {
    backgroundColor: 'rgba(229,9,20,0.85)',
    padding: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  episodesButton: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  liveBadge: {
    // Sem botão "Voltar" nesta tela (navegação pelo gesto/botão normal do
    // aparelho) — fica à mesma altura do grupo de ícones do lado direito.
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(217,22,32,0.9)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    zIndex: 10,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#fff',
  },
  liveBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  topRightStack: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  backText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 5,
  },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 },
  errorText: { color: '#ff6b6b', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  // Antes ficava a `bottom: 0` com fundo quase opaco — exatamente onde o
  // player nativo (`nativeControls`) desenha a barra de progresso e o
  // tempo, tapando-os por completo. Movido para debaixo do botão
  // "Voltar"/topo (que ocupam até ~top:90), sem fundo sólido, só com
  // sombra no texto — não interfere com os controlos nativos em lado
  // nenhum do ecrã.
  titleContainer: {
    position: 'absolute',
    top: 92,
    left: 20,
    right: 20,
  },
  titleText: { color: '#fff', fontSize: 17, lineHeight: 22, fontWeight: '800', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  episodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  episodeHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  inlineResolving: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  inlineResolvingText: {
    color: '#8e8e93',
    fontSize: 13,
  },
  episodeList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  contentCover: {
    height: 250,
    marginTop: 2,
    marginBottom: 4,
    overflow: 'hidden',
    backgroundColor: '#111113',
  },
  contentCoverFallback: { alignItems: 'center', justifyContent: 'center' },
  contentCoverGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '78%' },
  contentCoverText: { position: 'absolute', left: 18, right: 18, bottom: 18, gap: 5 },
  contentCoverEyebrow: { color: '#ff777d', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  contentCoverTitle: { color: '#fff', fontSize: 22, lineHeight: 27, fontWeight: '800' },
  downloadButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  episodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  episodeIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  episodeIndexText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  episodeThumb: {
    width: 46,
    height: 66,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 12,
  },
  episodeItemText: { color: '#fff', fontSize: 15, flex: 1 },
});

export default styles;
