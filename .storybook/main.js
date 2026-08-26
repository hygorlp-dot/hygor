export default {
  stories: [
    "../src/design-system/stories/**/*.stories.@(js|jsx)",
    "../src/components/charts/**/*.stories.@(js|jsx)",
  ],
  addons: [],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: { autodocs: "tag" },
};
