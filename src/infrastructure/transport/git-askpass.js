const prompt = process.argv.slice(2).join(' ').toLowerCase();
const value = prompt.includes('username')
    ? process.env.LLMPKG_GIT_USERNAME
    : process.env.LLMPKG_GIT_PASSWORD;
process.stdout.write(value ?? '');
