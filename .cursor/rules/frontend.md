# 🌐 Regras para o Frontend do Catálogo ML

## 📋 Estrutura

O frontend do Catálogo ML é implementado como uma aplicação React moderna. Esta abordagem foi escolhida para permitir uma experiência de usuário interativa e reativa, mesmo mantendo o código acessível para desenvolvedores iniciantes.

## 🚀 Tecnologias

- **React 17**: Biblioteca principal para construção da interface
- **Material UI**: Sistema de design para componentes estilizados
- **React Router**: Para navegação entre páginas
- **React Konva**: Para manipulação de elementos gráficos (anotações)
- **Axios**: Para comunicação com a API do backend

## 🔧 Padrões de Desenvolvimento

1. **Organização de Componentes**
   - Componentes reutilizáveis devem ser colocados na pasta `components/`
   - Páginas completas devem ficar na pasta `pages/`
   - Layouts compartilhados devem ser organizados em `layouts/`

2. **Estilo de Código**
   - Usar componentes funcionais com hooks
   - Separar lógica de negócio da interface quando possível
   - Nomear componentes, funções e variáveis em português
   - Incluir comentários explicativos para desenvolvedores iniciantes

3. **Gerenciamento de Estado**
   - Usar React Context para estado global quando necessário
   - Hooks personalizados para lógica reutilizável
   - React Query para comunicação com a API e caching

4. **Estilização**
   - Seguir o tema definido no Material UI
   - Usar o sistema de design (cores, tipografia, espaçamento) consistentemente
   - Garantir acessibilidade e responsividade em todos os componentes

## 📝 Processo de Desenvolvimento

Para trabalhar no frontend:

1. Entender a estrutura do componente ou página a ser modificado
2. Implementar alterações localmente com `npm start`
3. Testar em diferentes resoluções de tela
4. Validar integração com o backend
5. Documentar quaisquer novas dependências ou padrões

## 🧪 Testes

- Implementar testes de componentes usando React Testing Library
- Focar em testes que simulam o comportamento do usuário
- Manter cobertura de código para funcionalidades críticas

## 📚 Recursos de Aprendizado

Para desenvolvedores iniciantes, recomendamos:

1. Documentação oficial do React: https://pt-br.reactjs.org/
2. Material UI: https://mui.com/pt/
3. React Router: https://reactrouter.com/
4. React Konva: https://konvajs.org/docs/react/ 