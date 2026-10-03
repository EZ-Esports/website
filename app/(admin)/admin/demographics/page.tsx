import { getStaffForAdminSection } from '@/app/lib/auth';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, desc, isNull } from 'drizzle-orm';
import DemographicsExplorer, { type DemographicRecord } from '@/app/components/admin/DemographicsExplorer';

export const metadata = {
  title: 'Student Demographics & Privacy Vault | Admin',
};

export default async function DemographicsAdminPage() {
  const staff = await getStaffForAdminSection('/admin/demographics');
  if (!staff) {
    return <PermissionDenied />;
  }

  let records: DemographicRecord[] = [];
  let schools: Array<{ id: string; name: string }> = [];

  try {
    const [demographicRows, schoolRows] = await Promise.all([
      db
        .select({
          id: schema.studentDemographics.id,
          memberId: schema.studentDemographics.memberId,
          legalFirstName: schema.studentDemographics.legalFirstName,
          legalLastName: schema.studentDemographics.legalLastName,
          birthDate: schema.studentDemographics.birthDate,
          gender: schema.studentDemographics.gender,
          race: schema.studentDemographics.race,
          ethnicity: schema.studentDemographics.ethnicity,
          countryOfBirth: schema.studentDemographics.countryOfBirth,
          parentsCountryOfBirth: schema.studentDemographics.parentsCountryOfBirth,
          primaryLanguageAtHome: schema.studentDemographics.primaryLanguageAtHome,
          isFreeOrReducedLunch: schema.studentDemographics.isFreeOrReducedLunch,
          isFirstGenCollege: schema.studentDemographics.isFirstGenCollege,
          doePetitionConsent: schema.studentDemographics.doePetitionConsent,
          surveyDetails: schema.studentDemographics.surveyDetails,
          createdAt: schema.studentDemographics.createdAt,
          memberFirstName: schema.members.firstName,
          memberLastName: schema.members.lastName,
          memberEmail: schema.members.email,
          memberDiscord: schema.members.discord,
          graduationYear: schema.members.graduationYear,
          schoolId: schema.schools.id,
          schoolName: schema.schools.name,
        })
        .from(schema.studentDemographics)
        .leftJoin(schema.members, eq(schema.studentDemographics.memberId, schema.members.id))
        .leftJoin(schema.schools, eq(schema.members.schoolId, schema.schools.id))
        .orderBy(desc(schema.studentDemographics.createdAt)),

      db
        .select({
          id: schema.schools.id,
          name: schema.schools.name,
        })
        .from(schema.schools)
        .where(isNull(schema.schools.deletedAt))
        .orderBy(schema.schools.name),
    ]);

    records = demographicRows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      legalFirstName: r.legalFirstName,
      legalLastName: r.legalLastName,
      birthDate: r.birthDate ? r.birthDate.toISOString() : '',
      gender: r.gender,
      race: r.race,
      ethnicity: r.ethnicity,
      countryOfBirth: r.countryOfBirth,
      parentsCountryOfBirth: r.parentsCountryOfBirth,
      primaryLanguageAtHome: r.primaryLanguageAtHome,
      isFreeOrReducedLunch: r.isFreeOrReducedLunch,
      isFirstGenCollege: r.isFirstGenCollege,
      doePetitionConsent: r.doePetitionConsent,
      surveyDetails: r.surveyDetails as any,
      createdAt: r.createdAt ? r.createdAt.toISOString() : '',
      memberFirstName: r.memberFirstName,
      memberLastName: r.memberLastName,
      memberEmail: r.memberEmail,
      memberDiscord: r.memberDiscord,
      graduationYear: r.graduationYear,
      schoolId: r.schoolId,
      schoolName: r.schoolName,
    }));

    schools = schoolRows;
  } catch (error) {
    console.error('Failed to load student demographics:', error);
  }

  return <DemographicsExplorer records={records} schools={schools} />;
}
