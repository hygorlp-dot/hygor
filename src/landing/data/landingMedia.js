// Configuração central de mídia da landing page. Nenhum arquivo é baixado
// ou extraído do Instagram automaticamente - os links abaixo são apenas
// referência editorial (link "Ver publicação"). Enquanto `localSource`/
// `videoSource`/`posterSource` estiverem vazios, os componentes exibem um
// placeholder elegante em vez de quebrar o layout ou simular uma imagem.
//
// Para publicar mídia real: salve o arquivo em
// public/media/landing/<hero|projects|testimonials|office>/ e preencha o
// campo correspondente aqui com o caminho público (ex.: "/media/landing/hero/capa.jpg").
export const landingMedia = {
  hero: {
    localSource: "",
    instagramUrl: "https://www.instagram.com/p/DIeb4pPRj6b/?img_index=1",
    alt: "Projeto arquitetônico da ARCD Construtech",
  },

  projects: [
    {
      id: "project-01",
      title: "Projeto em destaque",
      category: "Arquitetura",
      city: "",
      localSource: "",
      instagramUrl: "https://www.instagram.com/p/DIUXbj8RWlv/",
    },
    {
      id: "project-02",
      title: "Projeto em destaque",
      category: "Arquitetura",
      city: "",
      localSource: "",
      instagramUrl: "https://www.instagram.com/p/CxEQAVhhJEA/",
    },
  ],

  testimonials: [
    {
      id: "testimonial-01",
      videoSource: "",
      posterSource: "",
      instagramUrl: "https://www.instagram.com/p/DMdedliJkz9/",
    },
    {
      id: "testimonial-02",
      videoSource: "",
      posterSource: "",
      instagramUrl: "https://www.instagram.com/p/DOBc_SDCkM-/",
    },
  ],

  office: {
    videoSource: "",
    posterSource: "",
    instagramUrl: "https://www.instagram.com/p/DJ2L3uiRTlh/",
  },
};
