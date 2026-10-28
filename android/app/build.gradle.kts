plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "kr.aneum.pilot"
    compileSdk = 35
    defaultConfig { applicationId = "kr.aneum.pilot"; minSdk = 28; targetSdk = 35; versionCode = 2; versionName = "0.2" }
    buildFeatures { buildConfig = true }
    flavorDimensions += "collection"
    productFlavors {
        create("usage") { dimension = "collection"; buildConfigField("boolean", "ENABLE_CALL_LOG", "false") }
        create("callTrial") { dimension = "collection"; applicationIdSuffix = ".calltrial"; buildConfigField("boolean", "ENABLE_CALL_LOG", "true") }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies { implementation("androidx.work:work-runtime-ktx:2.10.0"); testImplementation("junit:junit:4.13.2") }
