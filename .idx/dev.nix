{ pkgs, ... }:
{
  channel = "unstable";
  packages = [
    pkgs.nodejs_22
    pkgs.pnpm
  ];
  env = {};
  idx = {
    extensions = [];
    previews = {
      enable = true;
      previews = {
        web = {
          command = [ "pnpm" "--filter" "@workspace/hochu-to" "run" "dev" ];
          manager = "web";
          env = { 
            PORT = "$PORT";
            BASE_PATH = "/";
          };
        };
      };
    };
    workspace = {
      onCreate = {
        npm-install = "pnpm install";
      };
      onStart = {
        backend = "pnpm --filter @workspace/api-server run dev";
      };
    };
  };
}
