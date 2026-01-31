import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext(null);

const translations = {
  pt: {
    // Common
    loading: 'Carregando...',
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    edit: 'Editar',
    create: 'Criar',
    search: 'Buscar',
    filter: 'Filtrar',
    actions: 'Ações',
    status: 'Status',
    active: 'Ativo',
    inactive: 'Inativo',
    all: 'Todos',
    yes: 'Sim',
    no: 'Não',
    confirm: 'Confirmar',
    back: 'Voltar',
    next: 'Próximo',
    previous: 'Anterior',
    close: 'Fechar',
    view: 'Visualizar',
    download: 'Baixar',
    upload: 'Upload',
    
    // Auth
    login: 'Entrar',
    logout: 'Sair',
    register: 'Cadastrar',
    email: 'E-mail',
    password: 'Senha',
    confirmPassword: 'Confirmar Senha',
    forgotPassword: 'Esqueceu a senha?',
    noAccount: 'Não tem conta?',
    hasAccount: 'Já tem conta?',
    invalidCredentials: 'Credenciais inválidas',
    loginSuccess: 'Login realizado com sucesso',
    logoutSuccess: 'Logout realizado com sucesso',
    
    // Navigation
    dashboard: 'Dashboard',
    users: 'Usuários',
    documents: 'Documentos',
    videos: 'Vídeos',
    locations: 'Locais',
    functions: 'Funções',
    formativeStages: 'Etapas Formativas',
    settings: 'Configurações',
    profile: 'Perfil',
    auditLogs: 'Logs de Auditoria',
    
    // Dashboard
    totalUsers: 'Total de Usuários',
    activeUsers: 'Usuários Ativos',
    totalDocuments: 'Total de Documentos',
    totalVideos: 'Total de Vídeos',
    recentActivity: 'Atividade Recente',
    statistics: 'Estatísticas',
    welcome: 'Bem-vindo',
    
    // Users
    fullName: 'Nome Completo',
    birthDate: 'Data de Nascimento',
    phone: 'Telefone',
    cpf: 'CPF',
    address: 'Endereço',
    cep: 'CEP',
    street: 'Rua',
    number: 'Número',
    complement: 'Complemento',
    neighborhood: 'Bairro',
    city: 'Cidade',
    state: 'Estado',
    location: 'Local de Missão',
    function: 'Função',
    formativeStage: 'Etapa Formativa',
    formador: 'Formador Responsável',
    role: 'Tipo de Usuário',
    photo: 'Foto',
    admin: 'Administrador',
    formadorRole: 'Formador',
    user: 'Usuário',
    newUser: 'Novo Usuário',
    editUser: 'Editar Usuário',
    userCreated: 'Usuário criado com sucesso',
    userUpdated: 'Usuário atualizado com sucesso',
    userDeleted: 'Usuário excluído com sucesso',
    
    // Documents
    title: 'Título',
    description: 'Descrição',
    category: 'Categoria',
    permissions: 'Permissões',
    version: 'Versão',
    views: 'Visualizações',
    downloads: 'Downloads',
    uploadedBy: 'Enviado por',
    newDocument: 'Novo Documento',
    editDocument: 'Editar Documento',
    documentCreated: 'Documento criado com sucesso',
    documentUpdated: 'Documento atualizado com sucesso',
    documentDeleted: 'Documento excluído com sucesso',
    selectFile: 'Selecionar Arquivo',
    dragDrop: 'Arraste e solte arquivos aqui',
    allowedFormats: 'Formatos permitidos',
    maxSize: 'Tamanho máximo',
    public: 'Público',
    
    // Videos
    videoType: 'Tipo de Vídeo',
    uploadVideo: 'Upload de Vídeo',
    externalLink: 'Link Externo',
    externalUrl: 'URL Externa',
    duration: 'Duração',
    progress: 'Progresso',
    completed: 'Concluído',
    newVideo: 'Novo Vídeo',
    editVideo: 'Editar Vídeo',
    videoCreated: 'Vídeo criado com sucesso',
    videoUpdated: 'Vídeo atualizado com sucesso',
    videoDeleted: 'Vídeo excluído com sucesso',
    watchVideo: 'Assistir Vídeo',
    
    // Locations
    locationName: 'Nome do Local',
    responsible: 'Responsável',
    capacity: 'Capacidade',
    newLocation: 'Novo Local',
    editLocation: 'Editar Local',
    locationCreated: 'Local criado com sucesso',
    locationUpdated: 'Local atualizado com sucesso',
    locationDeleted: 'Local excluído com sucesso',
    
    // Functions
    functionName: 'Nome da Função',
    hierarchyLevel: 'Nível Hierárquico',
    newFunction: 'Nova Função',
    editFunction: 'Editar Função',
    functionCreated: 'Função criada com sucesso',
    functionUpdated: 'Função atualizada com sucesso',
    functionDeleted: 'Função excluída com sucesso',
    
    // Formative Stages
    stageName: 'Nome da Etapa',
    order: 'Ordem',
    estimatedDuration: 'Duração Estimada',
    prerequisites: 'Pré-requisitos',
    newStage: 'Nova Etapa',
    editStage: 'Editar Etapa',
    stageCreated: 'Etapa criada com sucesso',
    stageUpdated: 'Etapa atualizada com sucesso',
    stageDeleted: 'Etapa excluída com sucesso',

    // User Journey
    userJourney: 'Jornada do Usuário',
    userJourneyDescription: 'Acompanhe a jornada formativa dos usuários',
    newTransition: 'Nova Transição',
    journeyTransitionCreated: 'Transição registrada com sucesso',
    totalStages: 'Total de Etapas',
    usersInJourney: 'Usuários em Jornada',
    usersWithoutStage: 'Sem Etapa',
    completionRate: 'Taxa de Participação',
    currentStage: 'Etapa Atual',
    progress: 'Progresso',
    notStarted: 'Não iniciado',
    noUsersFound: 'Nenhum usuário encontrado',
    withoutStage: 'Sem etapa',
    distributionByStage: 'Distribuição por Etapa',
    distributionByStageDescription: 'Quantidade de usuários em cada etapa formativa',
    overview: 'Visão Geral',
    journeyOf: 'Jornada de',
    transitionHistory: 'Histórico de Transições',
    startedIn: 'Iniciou em',
    noJourneyRecords: 'Nenhum registro de jornada encontrado',
    addTransition: 'Adicionar Transição',
    selectUser: 'Selecione um usuário',
    selectStage: 'Selecione uma etapa',
    newStage: 'Nova Etapa',
    notes: 'Observações',
    transitionNotesPlaceholder: 'Adicione observações sobre esta transição...',
    
    // Permissions
    byLocation: 'Por Local',
    byUser: 'Por Usuário',
    byFunction: 'Por Função',
    byStage: 'Por Etapa',
    selectLocations: 'Selecionar Locais',
    selectUsers: 'Selecionar Usuários',
    selectFunctions: 'Selecionar Funções',
    selectStages: 'Selecionar Etapas',
    
    // Errors
    error: 'Erro',
    errorOccurred: 'Ocorreu um erro',
    notFound: 'Não encontrado',
    accessDenied: 'Acesso negado',
    requiredField: 'Campo obrigatório',
    invalidEmail: 'E-mail inválido',
    passwordTooShort: 'Senha muito curta',
    passwordsDoNotMatch: 'Senhas não conferem',
    
    // Success
    success: 'Sucesso',
    savedSuccessfully: 'Salvo com sucesso',
    deletedSuccessfully: 'Excluído com sucesso',
    
    // Confirmation
    confirmDelete: 'Confirmar Exclusão',
    confirmDeleteMessage: 'Tem certeza que deseja excluir este item?',
    actionCannotBeUndone: 'Esta ação não pode ser desfeita.',
  },
  en: {
    // Common
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    filter: 'Filter',
    actions: 'Actions',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    all: 'All',
    yes: 'Yes',
    no: 'No',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    close: 'Close',
    view: 'View',
    download: 'Download',
    upload: 'Upload',
    
    // Auth
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot password?',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    invalidCredentials: 'Invalid credentials',
    loginSuccess: 'Login successful',
    logoutSuccess: 'Logout successful',
    
    // Navigation
    dashboard: 'Dashboard',
    users: 'Users',
    documents: 'Documents',
    videos: 'Videos',
    locations: 'Locations',
    functions: 'Functions',
    formativeStages: 'Formative Stages',
    settings: 'Settings',
    profile: 'Profile',
    auditLogs: 'Audit Logs',
    
    // Dashboard
    totalUsers: 'Total Users',
    activeUsers: 'Active Users',
    totalDocuments: 'Total Documents',
    totalVideos: 'Total Videos',
    recentActivity: 'Recent Activity',
    statistics: 'Statistics',
    welcome: 'Welcome',
    
    // Users
    fullName: 'Full Name',
    birthDate: 'Birth Date',
    phone: 'Phone',
    cpf: 'CPF',
    address: 'Address',
    cep: 'ZIP Code',
    street: 'Street',
    number: 'Number',
    complement: 'Complement',
    neighborhood: 'Neighborhood',
    city: 'City',
    state: 'State',
    location: 'Mission Location',
    function: 'Function',
    formativeStage: 'Formative Stage',
    formador: 'Responsible Trainer',
    role: 'User Type',
    photo: 'Photo',
    admin: 'Administrator',
    formadorRole: 'Trainer',
    user: 'User',
    newUser: 'New User',
    editUser: 'Edit User',
    userCreated: 'User created successfully',
    userUpdated: 'User updated successfully',
    userDeleted: 'User deleted successfully',
    
    // Documents
    title: 'Title',
    description: 'Description',
    category: 'Category',
    permissions: 'Permissions',
    version: 'Version',
    views: 'Views',
    downloads: 'Downloads',
    uploadedBy: 'Uploaded by',
    newDocument: 'New Document',
    editDocument: 'Edit Document',
    documentCreated: 'Document created successfully',
    documentUpdated: 'Document updated successfully',
    documentDeleted: 'Document deleted successfully',
    selectFile: 'Select File',
    dragDrop: 'Drag and drop files here',
    allowedFormats: 'Allowed formats',
    maxSize: 'Max size',
    public: 'Public',
    
    // Videos
    videoType: 'Video Type',
    uploadVideo: 'Upload Video',
    externalLink: 'External Link',
    externalUrl: 'External URL',
    duration: 'Duration',
    progress: 'Progress',
    completed: 'Completed',
    newVideo: 'New Video',
    editVideo: 'Edit Video',
    videoCreated: 'Video created successfully',
    videoUpdated: 'Video updated successfully',
    videoDeleted: 'Video deleted successfully',
    watchVideo: 'Watch Video',
    
    // Locations
    locationName: 'Location Name',
    responsible: 'Responsible',
    capacity: 'Capacity',
    newLocation: 'New Location',
    editLocation: 'Edit Location',
    locationCreated: 'Location created successfully',
    locationUpdated: 'Location updated successfully',
    locationDeleted: 'Location deleted successfully',
    
    // Functions
    functionName: 'Function Name',
    hierarchyLevel: 'Hierarchy Level',
    newFunction: 'New Function',
    editFunction: 'Edit Function',
    functionCreated: 'Function created successfully',
    functionUpdated: 'Function updated successfully',
    functionDeleted: 'Function deleted successfully',
    
    // Formative Stages
    stageName: 'Stage Name',
    order: 'Order',
    estimatedDuration: 'Estimated Duration',
    prerequisites: 'Prerequisites',
    newStage: 'New Stage',
    editStage: 'Edit Stage',
    stageCreated: 'Stage created successfully',
    stageUpdated: 'Stage updated successfully',
    stageDeleted: 'Stage deleted successfully',

    // User Journey
    userJourney: 'User Journey',
    userJourneyDescription: 'Track the formative journey of users',
    newTransition: 'New Transition',
    journeyTransitionCreated: 'Transition recorded successfully',
    totalStages: 'Total Stages',
    usersInJourney: 'Users in Journey',
    usersWithoutStage: 'Without Stage',
    completionRate: 'Participation Rate',
    currentStage: 'Current Stage',
    progress: 'Progress',
    notStarted: 'Not started',
    noUsersFound: 'No users found',
    withoutStage: 'Without stage',
    distributionByStage: 'Distribution by Stage',
    distributionByStageDescription: 'Number of users in each formative stage',
    overview: 'Overview',
    journeyOf: 'Journey of',
    transitionHistory: 'Transition History',
    startedIn: 'Started in',
    noJourneyRecords: 'No journey records found',
    addTransition: 'Add Transition',
    selectUser: 'Select a user',
    selectStage: 'Select a stage',
    notes: 'Notes',
    transitionNotesPlaceholder: 'Add notes about this transition...',

    // Permissions
    byLocation: 'By Location',
    byUser: 'By User',
    byFunction: 'By Function',
    byStage: 'By Stage',
    selectLocations: 'Select Locations',
    selectUsers: 'Select Users',
    selectFunctions: 'Select Functions',
    selectStages: 'Select Stages',
    
    // Errors
    error: 'Error',
    errorOccurred: 'An error occurred',
    notFound: 'Not found',
    accessDenied: 'Access denied',
    requiredField: 'Required field',
    invalidEmail: 'Invalid email',
    passwordTooShort: 'Password too short',
    passwordsDoNotMatch: 'Passwords do not match',
    
    // Success
    success: 'Success',
    savedSuccessfully: 'Saved successfully',
    deletedSuccessfully: 'Deleted successfully',
    
    // Confirmation
    confirmDelete: 'Confirm Delete',
    confirmDeleteMessage: 'Are you sure you want to delete this item?',
    actionCannotBeUndone: 'This action cannot be undone.',
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('language');
      if (stored) return stored;
      const browserLang = navigator.language.split('-')[0];
      return browserLang === 'pt' ? 'pt' : 'en';
    }
    return 'pt';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'pt' ? 'en' : 'pt');
  };

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t,
    isPortuguese: language === 'pt',
    isEnglish: language === 'en'
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
