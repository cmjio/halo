// Blueprint files are bundled into the CLI as text (`import x from "..." with { type: "text" }`).
declare module "*.halo" {
  const text: string;
  export default text;
}
declare module "*.md" {
  const text: string;
  export default text;
}
declare module "*.example" {
  const text: string;
  export default text;
}
declare module "*.gitignore" {
  const text: string;
  export default text;
}
declare module "*/Dockerfile" {
  const text: string;
  export default text;
}
