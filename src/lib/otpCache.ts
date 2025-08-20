import NodeCache from "node-cache";
const otpCache = new NodeCache({ stdTTL: 300 });
export default otpCache;